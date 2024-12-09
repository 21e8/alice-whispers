/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ErrorPattern, ErrorPatternConfig, SeverityLevel } from '../types';
import Queue from './queue';

// Store error patterns
const errorPatterns: Queue<ErrorPattern> = new Queue([
  // Database constraint violations
  [/duplicate key value/i, 'DATABASE_CONSTRAINT_VIOLATION', 'medium'],
  // Connection errors
  [/connection refused/i, 'CONNECTION_ERROR', 'high'],
]);

// Track message occurrences for aggregation

// Track message occurrences for aggregation
type MessageGroup = {
  count: number;
  category: string;
  severity: SeverityLevel;
  level: string;
  firstSeen: number;
  windowMs: number;
};

const messageGroups = new Map<string, MessageGroup>();

export function addErrorPatterns(patterns: ErrorPatternConfig[]) {
  for (const pattern of patterns) {
    const { pattern: matcher, category, severity, aggregation } = pattern;
    const entry: ErrorPattern = [
      matcher,
      category,
      severity,
      aggregation
        ? [aggregation.windowMs, aggregation.countThreshold]
        : undefined,
    ];
    errorPatterns.enqueue(entry);
  }
}

export function clearErrorPatterns() {
  errorPatterns.clear();
}

export function clearErrorTracking() {
  const now = Date.now();
  for (const [key, group] of messageGroups.entries()) {
    const age = now - group.firstSeen;
    if (age > group.windowMs) {
      messageGroups.delete(key);
    }
  }
}

export type ClassifiedError = readonly [
  string, // message
  string, // category
  SeverityLevel, // severity
  [number, number] | undefined, // [count, windowMs] for aggregation
  boolean, // isAggregated
  number // occurrences
];

export function classifyMessage(
  message: string,
  level = 'error'
): ClassifiedError {
  const now = Date.now();

  // Try each pattern
  for (const [pattern, category, severity, aggregation] of errorPatterns) {
    let matches = false;

    if (pattern instanceof RegExp) {
      matches = pattern.test(message);
    } else if (typeof pattern === 'function') {
      matches = pattern(message);
    }

    if (matches) {
      if (aggregation) {
        const [windowMs, countThreshold] = aggregation;
        const key = `${category}-${severity}-${level}`;

        let group = messageGroups.get(key);
        if (!group) {
          group = {
            count: 0,
            category,
            severity,
            level,
            firstSeen: now,
            windowMs,
          };
          messageGroups.set(key, group);
        }

        // Only increment if within window
        const age = now - group.firstSeen;
        if (age <= windowMs) {
          group.count++;
          if (group.count >= countThreshold) {
            return [
              message,
              category,
              severity,
              [group.count, age],
              true,
              group.count,
            ];
          }
        } else {
          // Start new window
          group.count = 1;
          group.firstSeen = now;
        }
      }

      return [message, category, severity, undefined, false, 1];
    }
  }

  return [message, 'UNKNOWN', 'low', undefined, false, 1];
}

export function formatClassifiedError(error: ClassifiedError): string {
  const [message, category, severity, aggregation, isAggregated, count] = error;
  
  if (isAggregated) {
    const timeStr = aggregation ? Math.round(aggregation[1] / 1000) + 's' : '10s';
    return `[AGGREGATED] ${count} similar ${category} messages in last ${timeStr}`;
  }
  
  return `Message: ${message}\nCategory: ${category}\nSeverity: ${severity}`;
}

export function getAggregatedErrors() {
  const now = Date.now();
  const result: Record<string, { count: number; windowMs: number }> = {};

  for (const [key, group] of messageGroups.entries()) {
    const age = now - group.firstSeen;
    if (age <= group.windowMs) {
      result[key] = {
        count: group.count,
        windowMs: age,
      };
    }
  }

  return result;
}
