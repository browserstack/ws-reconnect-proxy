const Queue = require('../Queue');
const mocha = require('mocha');
const { expect } = require('chai');

describe('Queue', () => {
  let queue;
  beforeEach(() => {
    queue = new Queue();
  });

  it('#enqueue', () => {
    const data = "DATA";
    queue.enqueue(data);
    expect(queue.size()).to.equal(1);
  });

  it('#size', () => {
    const data = "DATA";
    queue.enqueue(data);
    queue.enqueue(data);
    expect(queue.size()).to.equal(2);
    expect(queue.isEmpty()).to.be.equal(false);
  });

  context('#dequeue', () => {
    it('#deque', () => {
      const data = "DATA";
      queue.enqueue(data);
      expect(queue.dequeue(data)).to.be.equal("DATA");
    });

    it('#deque in empty queue', () => {
      expect(queue.dequeue('DATA')).to.be.equal(null);
    });
  });

  it('#isEmpty', () => {
    expect(queue.isEmpty()).to.be.equal(true);
  });
});
