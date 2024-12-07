type ErrorPattern = {
  pattern: RegExp;
  category: string;
  severity: 'low' | 'medium' | 'high';
  aggregation?: {
    windowMs: number;    // Time window to aggregate similar errors
    countThreshold: number;  // Number of errors before aggregating
  };
};

// Default patterns
const DEFAULT_ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /duplicate key value violates unique constraint/i,
    category: 'DATABASE_CONSTRAINT_VIOLATION',
    severity: 'medium',
    aggregation: {
      windowMs: 60000,  // 1 minute
      countThreshold: 5 // Aggregate after 5 similar errors
    }
  },
  {
    pattern: /connection refused|connection timeout/i,
    category: 'CONNECTION_ERROR',
    severity: 'high',
  },
  {
    pattern: /invalid signature|unauthorized/i,
    category: 'AUTH_ERROR',
    severity: 'high',
  },
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

// Track error occurrences for aggregation
const errorTracker = new Map<string, {
  timestamps: number[];
  count: number;
  firstOccurrence: number;
}>();

type ClassifiedError = {
  originalMessage: string;
  category: string;
  severity: 'low' | 'medium' | 'high';
  details?: Record<string, string>;
  isAggregated: boolean;
  occurrences?: number;
  timeWindow?: string;
};

export function classifyError(error: Error | string): ClassifiedError {
  const message = error instanceof Error ? error.message : error;
  const now = Date.now();

  for (const { pattern, category, severity, aggregation } of getPatterns()) {
    if (pattern.test(message)) {
      const details: Record<string, string> = {};
      let trackerKey = `${category}`;

      if (category === 'DATABASE_CONSTRAINT_VIOLATION') {
        const constraint = message.match(/constraint "([^"]+)"/)?.[1];
        if (constraint) {
          details.constraint = constraint;
          trackerKey += `:${constraint}`;
        }
      }

      if (aggregation) {
        const tracker = errorTracker.get(trackerKey) || {
          timestamps: [],
          count: 0,
          firstOccurrence: now
        };

        // Clean old timestamps
        tracker.timestamps = tracker.timestamps.filter(
          t => t > now - aggregation.windowMs
        );
        tracker.timestamps.push(now);
        tracker.count++;

        errorTracker.set(trackerKey, tracker);

        if (tracker.timestamps.length >= aggregation.countThreshold) {
          const timeWindow = Math.ceil((now - tracker.firstOccurrence) / 1000);
          return {
            originalMessage: message,
            category,
            severity,
            details,
            isAggregated: true,
            occurrences: tracker.count,
            timeWindow: `${timeWindow}s`
          };
        }
      }

      return {
        originalMessage: message,
        category,
        severity,
        details,
        isAggregated: false
      };
    }
  }

  return {
    originalMessage: message,
    category: 'UNKNOWN_ERROR',
    severity: 'medium',
    isAggregated: false
  };
}

// Optional: Add method to clear error tracking
export function clearErrorTracking(): void {
  errorTracker.clear();
}
