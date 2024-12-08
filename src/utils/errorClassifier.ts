import { SeverityLevel } from "../types";

// Define the named object interface
export type ErrorPatternConfig = {
  name: string;
  pattern:
    | RegExp
    | ((message: string) => boolean)
    | Promise<boolean>
    | ((message: string) => Promise<boolean>);
  category: string;
  severity: SeverityLevel;
  aggregation?: {
    windowMs: number;
    countThreshold: number;
  };
};

// Internal tuple type for storage
type ErrorPattern = readonly [
  (
    | RegExp
    | ((message: string) => boolean)
    | Promise<boolean>
    | ((message: string) => Promise<boolean>)
  ),
  string, // category
  SeverityLevel, // severity
  [number, number]? // [windowMs, countThreshold] for aggregation
];

// Convert config to internal pattern
function configToPattern(config: ErrorPatternConfig): ErrorPattern {
  return [
    config.pattern,
    config.category,
    config.severity,
    config.aggregation
      ? [config.aggregation.windowMs, config.aggregation.countThreshold]
      : undefined,
  ];
}

// Default patterns as named objects
const DEFAULT_ERROR_PATTERNS: ErrorPatternConfig[] = [
  {
    name: 'uniqueConstraint',
    pattern: /duplicate key value violates unique constraint/i,
    category: 'DATABASE_CONSTRAINT_VIOLATION',
    severity: 'medium',
    aggregation: {
      windowMs: 60000,
      countThreshold: 5,
    },
  },
  {
    name: 'connectionError',
    pattern: /connection refused|connection timeout/i,
    category: 'CONNECTION_ERROR',
    severity: 'high',
  },
  {
    name: 'authError',
    pattern: /invalid signature|unauthorized/i,
    category: 'AUTH_ERROR',
    severity: 'high',
  },
];

// Store custom patterns
let customPatterns: ErrorPattern[] = [];

export function addErrorPatterns(patterns: readonly ErrorPatternConfig[]): void {
  customPatterns = customPatterns.concat(patterns.map(configToPattern));
}

export function resetErrorPatterns(): void {
  customPatterns = [];
}

// Get all patterns (custom patterns take precedence)
function getPatterns(): ErrorPattern[] {
  return [...customPatterns, ...DEFAULT_ERROR_PATTERNS.map(configToPattern)];
}

// Track error occurrences using arrays
const errorTracker = new Map<
  string,
  [
    number[], // timestamps
    number, // count
    number // firstOccurrence
  ]
>();

// Result tuple type
type ClassifiedError = readonly [
  string, // originalMessage
  string, // category
  SeverityLevel, // severity
  string[], // details (key-value pairs flattened)
  boolean, // isAggregated
  number?, // occurrences
  string? // timeWindow
];

export async function classifyError(
  error: Error | string
): Promise<ClassifiedError> {
  const message = error instanceof Error ? error.message : error;
  const now = Date.now();

  const patterns = getPatterns();

  for (const [pattern, category, severity, aggregation] of patterns) {
    let matches = false;
    if (pattern instanceof RegExp) {
      matches = pattern.test(message);
    } else if (pattern instanceof Promise) {
      matches = await pattern;
    } else {
      matches = await pattern(message);
    }

    if (matches) {
      const details: string[] = [];
      let trackerKey = category;

      if (category === 'DATABASE_CONSTRAINT_VIOLATION') {
        const constraint = message.match(/constraint "([^"]+)"/)?.[1];
        if (constraint) {
          details.push('constraint', constraint);
          trackerKey += `:${constraint}`;
        }
      }

      if (aggregation) {
        const [windowMs, countThreshold] = aggregation;
        const tracker = errorTracker.get(trackerKey) || [[], 0, now];
        const [timestamps, count, firstOccurrence] = tracker;

        // Clean old timestamps
        const validTimestamps = timestamps.filter((t) => t > now - windowMs);
        validTimestamps.push(now);

        errorTracker.set(trackerKey, [
          validTimestamps,
          count + 1,
          firstOccurrence,
        ]);

        if (validTimestamps.length >= countThreshold) {
          const timeWindow = Math.ceil((now - firstOccurrence) / 1000);
          return [
            message,
            category,
            severity,
            details,
            true,
            count + 1,
            `${timeWindow}s`,
          ];
        }
      }

      return [message, category, severity, details, false];
    }
  }

  return [message, 'UNKNOWN_ERROR', 'medium', [], false];
}

// Helper to convert classified error to readable format
type DetailMap = Record<string, string>;

export function formatClassifiedError(error: ClassifiedError): string {
  const [
    message,
    category,
    severity,
    details,
    isAggregated,
    occurrences,
    timeWindow,
  ] = error;

  if (isAggregated) {
    let formatted = `[AGGREGATED] ${occurrences} similar errors in ${timeWindow}`;
    if (details.length > 0) {
      const detailsObj = {} as DetailMap;
      for (let i = 0; i < details.length; i += 2) {
        detailsObj[details[i]] = details[i + 1];
      }
      formatted += `\nDetails: ${JSON.stringify(detailsObj)}`;
    }
    return formatted;
  }

  let formatted = `Message: ${message}\nCategory: ${category}\nSeverity: ${severity}`;
  if (details.length > 0) {
    const detailsObj = {} as DetailMap;
    for (let i = 0; i < details.length; i += 2) {
      detailsObj[details[i]] = details[i + 1];
    }
    formatted += `\nDetails: ${JSON.stringify(detailsObj)}`;
  }

  return formatted;
}

// Optional: Add method to clear error tracking
export function clearErrorTracking(): void {
  errorTracker.clear();
}
