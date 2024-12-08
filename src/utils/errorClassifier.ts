/* eslint-disable @typescript-eslint/no-non-null-assertion */
import type { ErrorPattern, ErrorPatternConfig, SeverityLevel } from '../types';

// Store error patterns
const errorPatterns: ErrorPattern[] = [];

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
    const { name, pattern: matcher, category, severity, aggregation } = pattern;
    const entry: ErrorPattern = [
      matcher,
      category,
      severity,
      aggregation
        ? [aggregation.windowMs, aggregation.countThreshold]
        : undefined,
    ];
    errorPatterns.push(entry);
  }
}

export function clearErrorPatterns() {
  errorPatterns.length = 0;
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

export type ClassifiedError = [
  message: string,
  category: string,
  severity: SeverityLevel,
  aggregated?: [count: number, windowMs: number]
];

export async function classifyError(
  error: Error | string,
  level = 'error'
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
      if (aggregation) {
        const [windowMs] = aggregation;
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
          return [
            `${group.count} ${level} messages of category ${category} occurred`,
            category,
            severity,
            [group.count, age],
          ];
        } else {
          // Start new window
          group.count = 1;
          group.firstSeen = now;
          return [message, category, severity];
        }
      }

      return [message, category, severity];
    }
  }

  return [message, 'UNKNOWN', 'low'];
}

export function formatClassifiedError(error: ClassifiedError): string {
  return error[0];
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
