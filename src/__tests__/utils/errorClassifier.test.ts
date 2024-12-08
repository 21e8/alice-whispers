import { ErrorPatternConfig } from '../../types';
import {
  addErrorPatterns,
  classifyError,
  resetErrorPatterns,
  formatClassifiedError,
  ClassifiedError,
} from '../../utils/errorClassifier';

describe('Error Classifier', () => {
  beforeEach(() => {
    resetErrorPatterns();
  });

  it('should classify database constraint violations', async () => {
    const error = new Error(
      'duplicate key value violates unique constraint "users_email_key"'
    );
    const result = await classifyError(error);
    expect(result[1]).toBe('DATABASE_CONSTRAINT_VIOLATION');
    expect(result[2]).toBe('medium');
    expect(result[3]).toEqual(['constraint', 'users_email_key']);
  });

  it('should classify connection errors', async () => {
    const error = new Error('connection refused');
    const result = await classifyError(error);
    expect(result[1]).toBe('CONNECTION_ERROR');
    expect(result[2]).toBe('high');
  });

  it('should allow custom error patterns', async () => {
    const customPattern: ErrorPatternConfig = {
      name: 'customError',
      pattern: /custom error pattern/i,
      category: 'CUSTOM_ERROR',
      severity: 'low',
    };
    addErrorPatterns([customPattern]);

    const error = new Error('Custom Error Pattern detected');
    const result = await classifyError(error);
    expect(result[1]).toBe('CUSTOM_ERROR');
    expect(result[2]).toBe('low');
  });

  it('should handle function patterns', async () => {
    const customPattern: ErrorPatternConfig = {
      name: 'functionPattern',
      pattern: (message: string) => message.includes('special error'),
      category: 'SPECIAL_ERROR',
      severity: 'medium',
    };
    addErrorPatterns([customPattern]);

    const error = new Error('This is a special error case');
    const result = await classifyError(error);
    expect(result[1]).toBe('SPECIAL_ERROR');
    expect(result[2]).toBe('medium');
  });

  it('should handle async function patterns', async () => {
    const customPattern: ErrorPatternConfig = {
      name: 'asyncPattern',
      pattern: async (message: string) =>
        Promise.resolve(message.includes('async error')),
      category: 'ASYNC_ERROR',
      severity: 'high',
    };
    addErrorPatterns([customPattern]);

    const error = new Error('This is an async error case');
    const result = await classifyError(error);
    expect(result[1]).toBe('ASYNC_ERROR');
    expect(result[2]).toBe('high');
  });

  it('should aggregate errors within time window', async () => {
    const customPattern: ErrorPatternConfig = {
      name: 'aggregatedError',
      pattern: /aggregate this/i,
      category: 'AGGREGATE_ERROR',
      severity: 'medium',
      aggregation: {
        windowMs: 1000,
        countThreshold: 2,
      },
    };
    addErrorPatterns([customPattern]);

    const error = new Error('Aggregate this error');
    const result1 = await classifyError(error);
    const result2 = await classifyError(error);

    expect(result2[4]).toBe(true); // isAggregated
    expect(result2[5]).toBe(2); // occurrences
  });

  describe('formatClassifiedError', () => {
    it('should format basic error info', () => {
      const error: ClassifiedError = [
        'Test error message',
        'TEST_CATEGORY',
        'high',
        [],
        false,
        0,
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe(
        'Message: Test error message\nCategory: TEST_CATEGORY\nSeverity: high'
      );
    });

    it('should format error with details', () => {
      const error: ClassifiedError = [
        'Test error message',
        'TEST_CATEGORY',
        'high',
        ['key1', 'value1', 'key2', 'value2'],
        false,
        0,
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe(
        'Message: Test error message\nCategory: TEST_CATEGORY\nSeverity: high\nDetails: {"key1":"value1","key2":"value2"}'
      );
    });

    it('should format error with empty details array', () => {
      const error: ClassifiedError = [
        'Test error message',
        'TEST_CATEGORY',
        'high',
        [],
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
        [],
        true,
        5,
        '10s',
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe('[AGGREGATED] 5 similar errors in 10s');
    });

    it('should format aggregated error with details', () => {
      const error: ClassifiedError = [
        'Test error message',
        'TEST_CATEGORY',
        'high',
        ['errorType', 'network', 'status', '500'],
        true,
        3,
        '5s',
      ];
      const formatted = formatClassifiedError(error);
      expect(formatted).toBe(
        '[AGGREGATED] 3 similar errors in 5s\nDetails: {"errorType":"network","status":"500"}'
      );
    });
  });
});
