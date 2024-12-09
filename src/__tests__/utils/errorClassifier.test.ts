// import type { ErrorPatternConfig } from '../../types';
import {
  classifyError,
  formatClassifiedError,
  ClassifiedError,
} from '../../utils/errorClassifier';

describe('Error Classifier', () => {
  it('should classify database constraint violations', () => {
    const error = new Error('duplicate key value');
    const result = classifyError(error);
    expect(result[1]).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(result[2]).toBe('medium');
  });

  it('should classify connection errors', () => {
    const error = new Error('connection refused');
    const result = classifyError(error);
    expect(result[1]).toBe('CONNECTION_ERROR');
    expect(result[2]).toBe('high');
  });

  it('should handle unknown errors', () => {
    const error = new Error('some random error');
    const result = classifyError(error);
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
        'Test error message',
        'TEST_CATEGORY',
        'high',
        undefined,
        true,
        5,
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe('[AGGREGATED] 5 similar errors in 10s');
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
        '[AGGREGATED] 3 similar errors in 5s\nDetails: {"errorType":"network","status":"500"}'
      );
    });
  });
});
