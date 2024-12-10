/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  classifyMessage,
  formatClassifiedError,
  addErrorPatterns,
  clearErrorPatterns,
  clearErrorTracking,
  // getAggregatedErrors,
  _resetForTesting,
  type ClassifiedError,
} from '../../utils/classify';

describe('Error Classifier', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Reset patterns and tracking before each test
    _resetForTesting();
    
    // Add default test patterns
    addErrorPatterns([
      {
        name: 'database',
        pattern: /duplicate key value/i,
        category: 'DATABASE_CONSTRAINT_VIOLATION',
        severity: 'medium',
      },
      {
        name: 'connection',
        pattern: /connection refused/i,
        category: 'CONNECTION_ERROR',
        severity: 'high',
      },
      {
        name: 'test',
        pattern: /test error/i,
        category: 'TEST_ERROR',
        severity: 'low',
        aggregation: {
          windowMs: 1000,
          countThreshold: 2,
        },
      },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
    _resetForTesting();
  });

  describe('classifyMessage', () => {

    it('should reset count and start new window when window expires', () => {
      // Add a pattern with a short window
      addErrorPatterns([{
        name: 'window-test',
        pattern: /test message/i,
        category: 'TEST_CATEGORY',
        severity: 'medium',
        aggregation: {
          windowMs: 100,  // Short window for testing
          countThreshold: 2
        }
      }]);
  
      // Send first message
      const result1 = classifyMessage('test message');
      expect(result1[4]).toBe(false); // Not aggregated
      expect(result1[5]).toBe(1);     // Count is 1
  
      // Advance time past window
      jest.advanceTimersByTime(150);  // More than windowMs
  
      // Send second message - should start new window
      const result2 = classifyMessage('test message');
      expect(result2[4]).toBe(false); // Not aggregated
      expect(result2[5]).toBe(1);     // Count should be reset to 1
  
      // Send third message immediately - should count in new window
      const result3 = classifyMessage('test message');
      expect(result3[4]).toBe(true);  // Now aggregated
      expect(result3[5]).toBe(2);     // Count should be 2 in new window
    });
    
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

    it('should handle function-based patterns', () => {
      addErrorPatterns([{
        name: 'func',
        pattern: (msg: string) => msg.includes('custom error'),
        category: 'CUSTOM_ERROR',
        severity: 'high',
      }]);

      const result = classifyMessage('this is a custom error message');
      expect(result[1]).toBe('CUSTOM_ERROR');
      expect(result[2]).toBe('high');
    });

    it('should handle message aggregation', () => {
      // Send multiple similar messages within window
      const results: ClassifiedError[] = [];
      for (let i = 0; i < 3; i++) {
        results.push(classifyMessage('test error message'));
      }

      // First message should not be aggregated
      expect(results[0][4]).toBe(false);
      
      // Later messages should be aggregated
      expect(results[2][4]).toBe(true);
      expect(results[2][5]).toBe(3); // Count should be 3
    });

    it('should reset aggregation after window expires', () => {
      // First batch of messages
      const result1 = classifyMessage('test error message');
      const result2 = classifyMessage('test error message');
      expect(result2[4]).toBe(true);
      expect(result2[5]).toBe(2);

      // Advance time past window
      jest.advanceTimersByTime(1100);
      clearErrorTracking();

      // New message should start fresh
      const result3 = classifyMessage('test error message');
      expect(result3[4]).toBe(false);
      expect(result3[5]).toBe(1);
    });
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

  describe('Error Pattern Management', () => {
    it('should add and clear error patterns', () => {
      clearErrorPatterns();
      
      // Should return UNKNOWN when no patterns exist
      const before = classifyMessage('duplicate key value');
      expect(before[1]).toBe('UNKNOWN');

      // Add a pattern
      addErrorPatterns([{
        name: 'test',
        pattern: /duplicate key value/i,
        category: 'DATABASE_ERROR',
        severity: 'high',
      }]);

      // Should match new pattern
      const after = classifyMessage('duplicate key value');
      expect(after[1]).toBe('DATABASE_ERROR');

      // Clear patterns
      clearErrorPatterns();
      const final = classifyMessage('duplicate key value');
      expect(final[1]).toBe('UNKNOWN');
    });

    it('should handle multiple patterns with same category', () => {
      addErrorPatterns([
        {
          name: 'db1',
          pattern: /unique constraint/i,
          category: 'DATABASE_ERROR',
          severity: 'medium',
        },
        {
          name: 'db2',
          pattern: /foreign key constraint/i,
          category: 'DATABASE_ERROR',
          severity: 'medium',
        },
      ]);

      const result1 = classifyMessage('unique constraint violation');
      const result2 = classifyMessage('foreign key constraint violation');

      expect(result1[1]).toBe('DATABASE_ERROR');
      expect(result2[1]).toBe('DATABASE_ERROR');
    });
  });

  // describe('getAggregatedErrors', () => {
  //   it('should return current aggregation state', () => {
  //     // Generate some aggregated errors
  //     for (let i = 0; i < 3; i++) {
  //       classifyMessage('test error message');
  //     }

  //     const aggregated = getAggregatedErrors();
  //     expect(Object.keys(aggregated).length).toBeGreaterThan(0);
      
  //     const key = 'TEST_ERROR-low-error';
  //     expect(aggregated[key]).toBeDefined();
  //     expect(aggregated[key].count).toBe(3);
  //     expect(aggregated[key].windowMs).toBeLessThanOrEqual(1000);
  //   });

  //   it('should not include expired windows', () => {
  //     // Generate aggregated errors
  //     for (let i = 0; i < 3; i++) {
  //       classifyMessage('test error message');
  //     }

  //     // Advance time past window
  //     jest.advanceTimersByTime(1100);
      
  //     const aggregated = getAggregatedErrors();
  //     expect(Object.keys(aggregated).length).toBe(0);
  //   });

  //   it('should track different error types separately', () => {
  //     // Add another pattern with aggregation
  //     addErrorPatterns([{
  //       name: 'another',
  //       pattern: /another error/i,
  //       category: 'ANOTHER_ERROR',
  //       severity: 'medium',
  //       aggregation: {
  //         windowMs: 1000,
  //         countThreshold: 2,
  //       },
  //     }]);

  //     // Generate different types of errors
  //     for (let i = 0; i < 2; i++) {
  //       classifyMessage('test error message');
  //       classifyMessage('another error message');
  //     }

  //     const aggregated = getAggregatedErrors();
  //     expect(Object.keys(aggregated).length).toBe(2);
  //     expect(aggregated['TEST_ERROR-low-error']).toBeDefined();
  //     expect(aggregated['ANOTHER_ERROR-medium-error']).toBeDefined();
  //   });
  // });
});
