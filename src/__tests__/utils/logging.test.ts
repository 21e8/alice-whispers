import { shouldLog, normalizeLogLevel } from '../../utils/logging';
import type { LogLevel, NotificationLevel } from '../../types';

describe('Logging Utilities', () => {
  describe('shouldLog', () => {
    const testCases: Array<[NotificationLevel, LogLevel, boolean]> = [
      // Error messages
      ['error', 'error', true],
      ['error', 'warn', true],
      ['error', 'info', true],
      ['error', 'debug', true],
      ['error', 'trace', true],
      ['error', 'none', false],

      // Warning messages
      ['warning', 'error', false],
      ['warning', 'warn', true],
      ['warning', 'info', true],
      ['warning', 'debug', true],
      ['warning', 'trace', true],
      ['warning', 'none', false],

      // Info messages
      ['info', 'error', false],
      ['info', 'warn', false],
      ['info', 'info', true],
      ['info', 'debug', true],
      ['info', 'trace', true],
      ['info', 'none', false],

      // None messages
      ['none', 'error', false],
      ['none', 'warn', false],
      ['none', 'info', false],
      ['none', 'debug', false],
      ['none', 'trace', false],
      ['none', 'none', false],
    ];

    test.each(testCases)(
      'message level %s with logger level %s should return %s',
      (messageLevel, loggerLevel, expected) => {
        expect(shouldLog(messageLevel, loggerLevel)).toBe(expected);
      }
    );

    it('should default to trace level when logger level is not provided', () => {
      expect(shouldLog('error')).toBe(true);
      expect(shouldLog('warning')).toBe(true);
      expect(shouldLog('info')).toBe(true);
      expect(shouldLog('none')).toBe(false);
    });

    it('should handle warning to warn level conversion correctly', () => {
      expect(shouldLog('warning', 'warn')).toBe(true);
      expect(shouldLog('warning', 'error')).toBe(false);
    });
  });

  describe('normalizeLogLevel', () => {
    it('should return trace for undefined level', () => {
      expect(normalizeLogLevel(undefined)).toBe('trace');
    });

    it('should return trace for invalid level', () => {
      expect(normalizeLogLevel('invalid' as LogLevel)).toBe('trace');
    });

    it('should return the same level for valid levels', () => {
      const validLevels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace', 'none'];
      validLevels.forEach(level => {
        expect(normalizeLogLevel(level)).toBe(level);
      });
    });

    it('should handle null and undefined gracefully', () => {
      // @ts-expect-error testing null
      expect(normalizeLogLevel(null)).toBe('trace');
      expect(normalizeLogLevel(undefined)).toBe('trace');
    });
  });

  describe('Log Level Hierarchy', () => {
    const loggerLevels: LogLevel[] = ['error', 'warn', 'info', 'debug', 'trace'];
    const messageLevels: NotificationLevel[] = ['error', 'warning', 'info'];

    it('should respect log level hierarchy', () => {
      loggerLevels.forEach((loggerLevel, i) => {
        messageLevels.forEach((messageLevel, j) => {
          const result = shouldLog(messageLevel, loggerLevel);
          // Message should be logged if its level index is less than or equal to logger level index
          // Note: warning maps to warn, so we need to handle that case
          const messageIndex = messageLevel === 'warning' ? 1 : j;
          expect(result).toBe(messageIndex <= i);
        });
      });
    });
  });
}); 