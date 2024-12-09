import type { LogLevel, NotificationLevel } from '../types';

// Order matters - from most severe to least severe
const LOG_LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace', 'none'];

export function shouldLog(messageLevel: NotificationLevel, loggerLevel: LogLevel = 'trace'): boolean {
  if (loggerLevel === 'none') return false;
  if (messageLevel === 'none') return false;

  // Convert notification level to log level
  const normalizedMessageLevel: LogLevel = messageLevel === 'warning' ? 'warn' : messageLevel;
  
  // Get indices to compare severity
  const messageIndex = LOG_LEVELS.indexOf(normalizedMessageLevel);
  const loggerIndex = LOG_LEVELS.indexOf(loggerLevel);
  
  // Lower index means higher severity
  // Message should be logged if its severity is higher or equal to logger level
  return messageIndex <= loggerIndex;
}

export function normalizeLogLevel(level?: LogLevel): LogLevel {
  if (!level || !LOG_LEVELS.includes(level)) {
    return 'trace'; // Most verbose by default
  }
  return level;
} 