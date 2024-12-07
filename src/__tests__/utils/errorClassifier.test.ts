import { createTelegramProcessor } from '../../processors/telegram';
import { classifyError, clearErrorTracking, addErrorPatterns } from '../../utils/errorClassifier';

describe('ErrorClassifier', () => {
  beforeEach(() => {
    clearErrorTracking();
  });

  describe('error aggregation', () => {
    it('should aggregate similar database errors after threshold', () => {
      const dbError = new Error('duplicate key value violates unique constraint "users_pkey"');
      
      // First 4 errors should not be aggregated
      for (let i = 0; i < 4; i++) {
        const result = classifyError(dbError);
        expect(result.isAggregated).toBe(false);
        expect(result.category).toBe('DATABASE_CONSTRAINT_VIOLATION');
      }

      // 5th error should trigger aggregation
      const aggregated = classifyError(dbError);
      expect(aggregated.isAggregated).toBe(true);
      expect(aggregated.occurrences).toBe(5);
      expect(aggregated.timeWindow).toBeDefined();
      expect(aggregated.details).toEqual({ constraint: 'users_pkey' });
    });

    it('should track different constraint violations separately', () => {
      const error1 = new Error('duplicate key value violates unique constraint "users_pkey"');
      const error2 = new Error('duplicate key value violates unique constraint "posts_pkey"');
      
      // Add 5 of each error
      for (let i = 0; i < 5; i++) {
        const result1 = classifyError(error1);
        const result2 = classifyError(error2);
        
        // Both should aggregate independently
        expect(result1.isAggregated).toBe(i === 4);
        expect(result2.isAggregated).toBe(i === 4);
      }
    });

    it('should clean old errors from aggregation window', () => {
      const dbError = new Error('duplicate key value violates unique constraint');
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      // Add 3 errors
      for (let i = 0; i < 3; i++) {
        classifyError(dbError);
      }

      // Move time forward past window
      jest.spyOn(Date, 'now').mockImplementation(() => now + 65000); // 65 seconds

      // Should not be aggregated as old errors are cleaned
      const result = classifyError(dbError);
      expect(result.isAggregated).toBe(false);
    });

    it('should handle custom error patterns with aggregation', () => {
      addErrorPatterns([{
        pattern: /custom error/i,
        category: 'CUSTOM_ERROR',
        severity: 'medium',
        aggregation: {
          windowMs: 10000,  // 10 seconds
          countThreshold: 3 // Aggregate after 3 errors
        }
      }]);

      const customError = new Error('Custom error occurred');
      
      // First 2 errors should not be aggregated
      for (let i = 0; i < 2; i++) {
        const result = classifyError(customError);
        expect(result.isAggregated).toBe(false);
        expect(result.category).toBe('CUSTOM_ERROR');
      }

      // 3rd error should trigger aggregation
      const aggregated = classifyError(customError);
      expect(aggregated.isAggregated).toBe(true);
      expect(aggregated.occurrences).toBe(3);
      expect(aggregated.timeWindow).toBeDefined();
    });

    it('should show correct time window in aggregated errors', () => {
      const dbError = new Error('duplicate key value violates unique constraint');
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      // Add errors with time gaps
      classifyError(dbError);
      jest.spyOn(Date, 'now').mockImplementation(() => now + 10000); // +10s
      classifyError(dbError);
      jest.spyOn(Date, 'now').mockImplementation(() => now + 20000); // +20s
      classifyError(dbError);
      jest.spyOn(Date, 'now').mockImplementation(() => now + 30000); // +30s
      classifyError(dbError);
      
      const aggregated = classifyError(dbError);
      expect(aggregated.isAggregated).toBe(true);
      expect(aggregated.timeWindow).toBe('30s');
    });

    it('should aggregate messages sent within milliseconds', () => {
      const dbError = new Error('duplicate key value violates unique constraint "users_pkey"');
      const now = Date.now();
      
      // Mock Date.now to return same timestamp for all messages
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      // Send 5 messages "simultaneously"
      const results = Array(5).fill(null).map(() => classifyError(dbError));

      // First 4 should not be aggregated
      for (let i = 0; i < 4; i++) {
        expect(results[i].isAggregated).toBe(false);
        expect(results[i].category).toBe('DATABASE_CONSTRAINT_VIOLATION');
      }

      // 5th message should show aggregation
      expect(results[4].isAggregated).toBe(true);
      expect(results[4].occurrences).toBe(5);
      expect(results[4].timeWindow).toBe('0s');
      expect(results[4].details).toEqual({ constraint: 'users_pkey' });
    });

    it('should show aggregated message in telegram format', async () => {
      const dbError = new Error('duplicate key value violates unique constraint "users_pkey"');
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      // Send 5 messages "simultaneously"
      const messages = Array(5).fill(null).map((_, i) => ({
        chatId: 'test',
        text: `Error ${i + 1}`,
        level: 'error' as const,
        error: dbError
      }));

      const processor = createTelegramProcessor({
        botToken: 'test',
        chatId: 'test'
      });

      await processor.processBatch(messages);

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(options.body);
      
      // Test the structure more precisely
      const lines = body.text.split('\n') as string[];
      expect(lines.some(line => line.includes('[AGGREGATED] 5 similar errors in 0s'))).toBe(true);
      expect(lines.some(line => line.includes('Category: DATABASE_CONSTRAINT_VIOLATION'))).toBe(true);
      
      // Test the JSON-formatted details
      const detailsLine = lines.find(line => line.includes('Details:')) as string;
      const details = JSON.parse(detailsLine.split('Details: ')[1]);
      expect(details).toEqual({ constraint: 'users_pkey' });
    });

    it('should reset error tracking between batches', async () => {
      const dbError = new Error('duplicate key value violates unique constraint "users_pkey"');
      const now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);

      const processor = createTelegramProcessor({
        botToken: 'test',
        chatId: 'test'
      });

      // First batch of 3 errors
      await processor.processBatch(Array(3).fill(null).map((_, i) => ({
        chatId: 'test',
        text: `Batch 1 Error ${i + 1}`,
        level: 'error' as const,
        error: dbError
      })));

      // Second batch of 3 errors - should not be aggregated because tracking was cleared
      await processor.processBatch(Array(3).fill(null).map((_, i) => ({
        chatId: 'test',
        text: `Batch 2 Error ${i + 1}`,
        level: 'error' as const,
        error: dbError
      })));

      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);

      // Check both batches were sent separately
      const batch1 = JSON.parse(calls[0][1].body);
      const batch2 = JSON.parse(calls[1][1].body);

      // Neither batch should show aggregation
      expect(batch1.text).not.toContain('[AGGREGATED]');
      expect(batch2.text).not.toContain('[AGGREGATED]');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
}); 