import Queue from '../../utils/queue';

describe('Queue', () => {
  let queue: Queue<number>;

  beforeEach(() => {
    queue = new Queue<number>();
  });

  describe('Basic Operations', () => {
    it('should start empty', () => {
      expect(queue.size).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should enqueue items', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      expect(queue.size).toBe(2);
      expect(queue.isEmpty()).toBe(false);
    });

    it('should dequeue items in FIFO order', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      expect(queue.dequeue()).toBe(1);
      expect(queue.dequeue()).toBe(2);
      expect(queue.dequeue()).toBe(3);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should return undefined when dequeuing from empty queue', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('should peek at front item without removing it', () => {
      queue.enqueue(1);
      queue.enqueue(2);

      expect(queue.peek()).toBe(1);
      expect(queue.size).toBe(2); // Size shouldn't change
    });

    it('should return undefined when peeking empty queue', () => {
      expect(queue.peek()).toBeUndefined();
    });
  });

  describe('Bulk Operations', () => {
    it('should initialize with array', () => {
      queue = new Queue([1, 2, 3]);
      expect(queue.size).toBe(3);
      expect(queue.toArray()).toEqual([1, 2, 3]);
    });

    it('should convert to array', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      expect(queue.toArray()).toEqual([1, 2, 3]);
      expect(queue.size).toBe(3); // Size shouldn't change
    });

    it('should clear all items', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      queue.clear();
      expect(queue.size).toBe(0);
      expect(queue.isEmpty()).toBe(true);
      expect(queue.toArray()).toEqual([]);
    });
  });

  describe('Iteration', () => {
    it('should be iterable', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      const items: number[] = [];
      for (const item of queue) {
        items.push(item);
      }

      expect(items).toEqual([1, 2, 3]);
    });

    it('should support forEach', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      const items: number[] = [];
      queue.toArray().forEach(item => items.push(item));

      expect(items).toEqual([1, 2, 3]);
    });

    it('should maintain order during iteration', () => {
      queue.enqueue(1);
      queue.enqueue(2);
      queue.enqueue(3);

      const iteratorItems = [...queue];
      const forEachItems: number[] = [];
      queue.toArray().forEach(item => forEachItems.push(item));
      const arrayItems = queue.toArray();

      expect(iteratorItems).toEqual([1, 2, 3]);
      expect(forEachItems).toEqual([1, 2, 3]);
      expect(arrayItems).toEqual([1, 2, 3]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle large number of operations', () => {
      const items = Array.from({ length: 10000 }, (_, i) => i);
      
      // Enqueue many items
      items.forEach(item => queue.enqueue(item));
      expect(queue.size).toBe(10000);

      // Dequeue half
      for (let i = 0; i < 5000; i++) {
        expect(queue.dequeue()).toBe(i);
      }
      expect(queue.size).toBe(5000);

      // Enqueue more
      for (let i = 10000; i < 15000; i++) {
        queue.enqueue(i);
      }
      expect(queue.size).toBe(10000);

      // Convert to array should maintain order
      const array = queue.toArray();
      expect(array.length).toBe(10000);
      expect(array[0]).toBe(5000);
      expect(array[array.length - 1]).toBe(14999);
    });

    it('should handle mixed types', () => {
      const mixedQueue = new Queue<string | number | boolean>();
      mixedQueue.enqueue('string');
      mixedQueue.enqueue(42);
      mixedQueue.enqueue(true);

      expect(mixedQueue.toArray()).toEqual(['string', 42, true]);
    });

    it('should handle objects', () => {
      interface TestObject {
        id: number;
        value: string;
      }

      const objectQueue = new Queue<TestObject>();
      const obj1 = { id: 1, value: 'one' };
      const obj2 = { id: 2, value: 'two' };

      objectQueue.enqueue(obj1);
      objectQueue.enqueue(obj2);

      expect(objectQueue.dequeue()).toBe(obj1);
      expect(objectQueue.peek()).toBe(obj2);
    });

    it('should handle undefined and null values', () => {
      const nullableQueue = new Queue<number | null | undefined>();
      nullableQueue.enqueue(1);
      nullableQueue.enqueue(null);
      nullableQueue.enqueue(undefined);
      nullableQueue.enqueue(2);

      expect(nullableQueue.toArray()).toEqual([1, null, undefined, 2]);
    });
  });
}); 