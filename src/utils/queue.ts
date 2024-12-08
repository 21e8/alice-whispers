// yoinked from https://github.com/sindresorhus/yocto-queue
// constant time enqueue and dequeue
// eslint-disable-next-line @typescript-eslint/no-explicit-any
class Node<T = any> {
  value: T;
  next: Node<T> | undefined;

  constructor(value: T) {
    this.value = value;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class Queue<T = any> {
  #head: Node<T> | undefined;
  #tail: Node<T> | undefined;
  #size = 0;

  constructor() {
    this.clear();
  }

  toArray(): T[] {
    return Array.from(this);
  }

  enqueue(value: T) {
    const node = new Node(value);

    if (this.#head) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.#tail!.next = node;
      this.#tail = node;
    } else {
      this.#head = node;
      this.#tail = node;
    }

    this.#size++;
  }

  dequeue() {
    const current = this.#head;
    if (!current) {
      return;
    }

    this.#head = this.#head?.next;
    this.#size--;
    return current.value;
  }

  peek() {
    if (!this.#head) {
      return;
    }

    return this.#head.value;
  }

  clear() {
    this.#head = undefined;
    this.#tail = undefined;
    this.#size = 0;
  }

  get size() {
    return this.#size;
  }

  *[Symbol.iterator]() {
    let current = this.#head;

    while (current) {
      yield current.value;
      current = current.next;
    }
  }
}
