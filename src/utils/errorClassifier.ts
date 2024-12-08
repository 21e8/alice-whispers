import type { ErrorPattern, ErrorPatternConfig, SeverityLevel } from '../types';

// Store error patterns
const errorPatterns: ErrorPattern[] = [];

// Track error occurrences for aggregation
type ErrorStats = {
  count: number;
  firstSeen: number;
  windowMs: number;
};

const errorTracking = new Map<string, ErrorStats>();

export function addErrorPatterns(patterns: ErrorPatternConfig[]) {
  for (const pattern of patterns) {
    const { name, pattern: matcher, category, severity, aggregation } = pattern;
    const entry: ErrorPattern = [
      matcher,
      category,
      severity,
      aggregation ? [aggregation.windowMs, aggregation.countThreshold] : undefined,
    ];
    errorPatterns.push(entry);
  }
}

export function clearErrorPatterns() {
  errorPatterns.length = 0;
}

export function clearErrorTracking() {
  errorTracking.clear();
}

export type ClassifiedError = [
  message: string,
  category: string,
  severity: SeverityLevel,
  aggregated?: [
    count: number,
    windowMs: number,
  ]
];

export function getAggregatedErrors() {
  const now = Date.now();
  const result: Record<string, { count: number; windowMs: number }> = {};

  // Clean up old entries and collect aggregation stats
  for (const [key, stats] of errorTracking.entries()) {
    const age = now - stats.firstSeen;
    if (age > stats.windowMs) {
      errorTracking.delete(key);
    } else {
      result[key] = {
        count: stats.count,
        windowMs: age,
      };
    }
  }

  return result;
}

export async function classifyError(
  error: Error | string
): Promise<ClassifiedError> {
  const message = error instanceof Error ? error.message : error;
  const now = Date.now();

  // Try each pattern
  for (const [pattern, category, severity, aggregation] of errorPatterns) {
    let matches = false;

    if (pattern instanceof RegExp) {
      matches = pattern.test(message);
    } else if (typeof pattern === 'function') {
      const result = pattern(message);
      matches = result instanceof Promise ? await result : result;
    }

    if (matches) {
      // If this pattern has aggregation config
      if (aggregation) {
        const [windowMs, countThreshold] = aggregation;
        const key = `${category}-${severity}`;
        
        // Get or create tracking stats
        let stats = errorTracking.get(key);
        if (!stats) {
          stats = { count: 0, firstSeen: now, windowMs };
          errorTracking.set(key, stats);
        }
        
        // Update count
        stats.count++;
        
        // If we've hit the threshold, include aggregation info
        if (stats.count >= countThreshold) {
          return [
            message,
            category,
            severity,
            [
              stats.count,
              now - stats.firstSeen,
            ],
          ];
        }
      }

      return [message, category, severity];
    }
  }

  // Default classification if no patterns match
  return [message, 'UNKNOWN', 'low'];
}

export function formatClassifiedError(error: ClassifiedError): string {
  let result = `Message: ${error[0]}\nCategory: ${error[1]}\nSeverity: ${error[2]}`;
  if (error[3]) {
    const seconds = Math.round(error[3][1] / 1000);
    result += `\n[AGGREGATED] ${error[3][0]} similar errors in ${seconds}s`;
  }
  return result;
}
