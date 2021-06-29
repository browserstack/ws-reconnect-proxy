class Queue {
  constructor() {
    this.list = [];
  }

  enque(data) {
    this.list.push(data);
  }

  dequeue() {
    if (this.isEmpty()) {
      return null;
    }
    return this.list.shift();
  }

  size() {
    return this.list.length;
  }

  isEmpty() {
    return this.size() == 0;
  }
}

module.exports = Queue;