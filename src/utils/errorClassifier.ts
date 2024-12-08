import { SeverityLevel, ErrorPatternConfig, ErrorPattern } from '../types';
import Queue from './queue';

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
const defaultPatterns = DEFAULT_ERROR_PATTERNS.map(configToPattern);

export function addErrorPatterns(
  patterns: readonly ErrorPatternConfig[]
): void {
  customPatterns = customPatterns.concat(patterns.map(configToPattern));
}

export function resetErrorPatterns(): void {
  customPatterns = [];
}

// Get all patterns (custom patterns take precedence)
function getPatterns(): ErrorPattern[] {
  return [...customPatterns, ...defaultPatterns];
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
export type ClassifiedError = readonly [
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
  const msg = error instanceof Error ? error.message : error;
  const now = Date.now();

  const patterns = getPatterns();

  for (const p of patterns) {
    let matches = false;
    if (p[0] instanceof RegExp) {
      matches = p[0].test(msg);
    } else if (p[0] instanceof Promise) {
      matches = await p[0];
    } else {
      matches = await p[0](msg);
    }

    if (matches) {
      const details = new Queue<string>();
      let trackerKey = p[1];

      if (p[1] === 'DATABASE_CONSTRAINT_VIOLATION') {
        const constraint = msg.match(/constraint "([^"]+)"/)?.[1];
        if (constraint) {
          details.enqueue(constraint);
          trackerKey += `:${constraint}`;
        }
      }

      if (p[3]) {
        const tracker = errorTracker.get(trackerKey) || [[], 0, now];

        // Clean old timestamps
        const validTimestamps = tracker[0].filter(
          (t) => t > now - (p[3]?.[0] ?? 0)
        );
        validTimestamps.push(now);

        errorTracker.set(trackerKey, [
          validTimestamps,
          tracker[1] + 1,
          tracker[2],
        ]);

        if (validTimestamps.length >= (p[3]?.[1] ?? 0)) {
          const timeWindow = Math.ceil((now - tracker[2]) / 1000);
          return [
            msg,
            p[1],
            p[2],
            details.toArray(),
            true,
            tracker[1] + 1,
            `${timeWindow}s`,
          ];
        }
      }

      return [msg, p[1], p[2], details.toArray(), false];
    }
  }

  return [msg, 'UNKNOWN_ERROR', 'medium', [], false];
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
