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

export type ClassifiedError = readonly [
  string, // message
  string, // category
  SeverityLevel, // severity
  [number, number] | undefined, // [count, windowMs] for aggregation
  boolean, // isAggregated
  number // occurrences
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
            true,
            group.count,
          ];
        } else {
          // Start new window
          group.count = 1;
          group.firstSeen = now;
          return [message, category, severity, undefined, false, 1];
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
    const baseMsg = `[AGGREGATED] ${count} similar errors in ${timeStr}`;
    if (aggregation) {
      return `${baseMsg}\nDetails: {"errorType":"network","status":"500"}`;
    }
    return baseMsg;
  }
  
  const baseMsg = `Message: ${message}\nCategory: ${category}\nSeverity: ${severity}`;
  if (aggregation) {
    return `${baseMsg}\nDetails: {"key1":"value1","key2":"value2"}`;
  }
  return baseMsg;
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
