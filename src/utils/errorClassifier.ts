// Define tuple types for better type safety
type ErrorPattern = readonly [
  RegExp, // pattern
  string, // category
  'low' | 'medium' | 'high', // severity
  [number, number]? // [windowMs, countThreshold] for aggregation
];

// Default patterns as tuples
const DEFAULT_ERROR_PATTERNS = [
  [
    /duplicate key value violates unique constraint/i,
    'DATABASE_CONSTRAINT_VIOLATION',
    'medium',
    [60000, 5], // 1 minute window, 5 errors threshold
  ],
  [/connection refused|connection timeout/i, 'CONNECTION_ERROR', 'high'],
  [/invalid signature|unauthorized/i, 'AUTH_ERROR', 'high'],
] satisfies ErrorPattern[];

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
  'low' | 'medium' | 'high', // severity
  string[], // details (key-value pairs flattened)
  boolean, // isAggregated
  number?, // occurrences
  string? // timeWindow
];

export function classifyError(error: Error | string): ClassifiedError {
  const message = error instanceof Error ? error.message : error;
  const now = Date.now();

  for (const [pattern, category, severity, aggregation] of getPatterns()) {
    if (pattern.test(message)) {
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
