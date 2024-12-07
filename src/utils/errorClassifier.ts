type ErrorPattern = {
  pattern: RegExp;
  category: string;
  severity: 'low' | 'medium' | 'high';
  backpressure?: {
    windowMs: number;
    maxErrors: number;
    cooldownMs: number;
  };
};

// Default patterns
const DEFAULT_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /duplicate key value violates unique constraint/i,
    category: 'DATABASE_CONSTRAINT_VIOLATION',
    severity: 'medium',
    backpressure: {
      windowMs: 60000,
      maxErrors: 5,
      cooldownMs: 300000
    }
  },
  {
    pattern: /connection refused|connection timeout/i,
    category: 'CONNECTION_ERROR',
    severity: 'high',
    backpressure: {
      windowMs: 30000,
      maxErrors: 3,
      cooldownMs: 60000
    }
  },
  {
    pattern: /invalid signature|unauthorized/i,
    category: 'AUTH_ERROR',
    severity: 'high'
  }
];

// Store custom patterns
let customPatterns: ErrorPattern[] = [];

export function addErrorPatterns(patterns: ErrorPattern[]): void {
  customPatterns = customPatterns.concat(patterns);
}

export function resetErrorPatterns(): void {
  customPatterns = [];
}

// Get all patterns (custom patterns take precedence)
function getPatterns(): ErrorPattern[] {
  return [...customPatterns, ...DEFAULT_ERROR_PATTERNS];
}

// Track error occurrences
const errorTracker = new Map<string, {
  timestamps: number[];
  cooldownUntil?: number;
}>();

type ClassifiedError = {
  originalMessage: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  details?: Record<string, string>;
  shouldThrottle: boolean;
  nextAllowedTimestamp?: number;
};

export function classifyError(error: Error | string): ClassifiedError {
  const message = error instanceof Error ? error.message : error;
  const now = Date.now();
  
  for (const { pattern, category, severity, backpressure } of getPatterns()) {
    if (pattern.test(message)) {
      const details: Record<string, string> = {};
      
      // Extract specific details based on category
      if (category === 'DATABASE_CONSTRAINT_VIOLATION') {
        const constraint = message.match(/constraint "([^"]+)"/)?.[1];
        if (constraint) {
          details.constraint = constraint;
        }
      }

      // Handle backpressure if configured
      let shouldThrottle = false;
      let nextAllowedTimestamp: number | undefined;

      if (backpressure) {
        const tracker = errorTracker.get(category) || { timestamps: [] };
        
        // Check if in cooldown
        if (tracker.cooldownUntil && now < tracker.cooldownUntil) {
          shouldThrottle = true;
          nextAllowedTimestamp = tracker.cooldownUntil;
        } else {
          // Clean old timestamps
          tracker.timestamps = tracker.timestamps.filter(
            t => t > now - backpressure.windowMs
          );

          // Add current timestamp
          tracker.timestamps.push(now);

          // Check if threshold exceeded
          if (tracker.timestamps.length >= backpressure.maxErrors) {
            shouldThrottle = true;
            tracker.cooldownUntil = now + backpressure.cooldownMs;
            nextAllowedTimestamp = tracker.cooldownUntil;
          }
        }

        errorTracker.set(category, tracker);
      }
      
      return {
        originalMessage: message,
        category,
        severity,
        details: Object.keys(details).length > 0 ? details : undefined,
        shouldThrottle,
        nextAllowedTimestamp
      };
    }
  }

  return {
    originalMessage: message,
    category: 'UNKNOWN_ERROR',
    severity: 'medium',
    shouldThrottle: false
  };
}

// Optional: Add method to clear error tracking
export function clearErrorTracking(): void {
  errorTracker.clear();
} 