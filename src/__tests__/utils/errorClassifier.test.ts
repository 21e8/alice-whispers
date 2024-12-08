import {
  addErrorPatterns,
  classifyError,
  resetErrorPatterns,
  type ErrorPatternConfig,
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
});
