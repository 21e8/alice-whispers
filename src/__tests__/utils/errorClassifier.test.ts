// import type { ErrorPatternConfig } from '../../types';
import {
  classifyMessage,
  formatClassifiedError,
  ClassifiedError,
} from '../../utils/classify';

describe('Message Classifier', () => {
  it('should classify database constraint violations', () => {
    const result = classifyMessage('duplicate key value', 'error');
    expect(result[1]).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(result[2]).toBe('medium');
  });

  it('should classify connection errors', () => {
    const result = classifyMessage('connection refused', 'error');
    expect(result[1]).toBe('CONNECTION_ERROR');
    expect(result[2]).toBe('high');
  });

  it('should handle unknown errors', () => {
    const result = classifyMessage('some random error', 'error');
    expect(result[1]).toBe('UNKNOWN');
    expect(result[2]).toBe('low');
  });

  it('should classify info messages', () => {
    const result = classifyMessage('Starting batch process', 'info');
    expect(result[1]).toBe('UNKNOWN');
    expect(result[2]).toBe('low');
  });

  it('should classify warning messages', () => {
    const result = classifyMessage('Resource usage high', 'warning');
    expect(result[1]).toBe('UNKNOWN');
    expect(result[2]).toBe('low');
  });

  describe('formatClassifiedError', () => {
    it('should format basic error info', () => {
      const error: ClassifiedError = [
        'Test error message',
        'TEST_CATEGORY',
        'high',
        undefined,
        false,
        0,
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe(
        'Message: Test error message\nCategory: TEST_CATEGORY\nSeverity: high'
      );
    });

    it('should format aggregated error without details', () => {
      const error: ClassifiedError = [
        'Message: Test error message',
        'TEST_CATEGORY',
        'high',
        undefined,
        true,
        5,
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe('[AGGREGATED] 5 similar TEST_CATEGORY messages in last 10s');
    });

    it('should format aggregated error with details', () => {
      const error: ClassifiedError = [
        'Test error message',
        'TEST_CATEGORY',
        'high',
        [3, 5000],
        true,
        3,
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe(
        '[AGGREGATED] 3 similar TEST_CATEGORY messages in last 5s'
      );
    });
  });
});
