const Context = require('../../lib/core/Context');
const { EventEmitter } = require('events');
const { describe, beforeEach, it, afterEach } = require('mocha');
const { assert, expect } = require('chai');
const WebSocket = require('ws');
const { spy, useFakeTimers } = require('sinon');

const {
  kDequeueMessage,
  kMessageReceived,
  kDrainCompleted,
  kError,
  kQueueMessage,
  kSendMessage,
  kDrainMessage,
  kUpstreamRestart,
  kReleaseTap,
  kClientClosed,
  kAddNewContext,
  kConnectionOpened,
  kEnableIncomingQueue,
  kEnableOutgoingQueue,
} = require('../../lib/config/constants');

describe('Context', () => {
  let context;
  let mockServer;
  const upstreamUrl = 'ws://localhost:8999/';
  const connectionId = 'TEST123';
  beforeEach(() => {
    this.clock = useFakeTimers();
    context = new Context(connectionId);
    mockServer = new WebSocket.Server({ port: 8999 });
    this.socket = {
      close: spy(),
      terminate: spy(),
      on: spy(),
      send: spy(),
    };

    this.request = {
      url: upstreamUrl,
      headers: {},
    };
    context.addNewConnection(this.socket, this.request);
    this.incomingSocket = context.incomingSocket;
    this.outgoingSocket = context.outgoingSocket;
  });

  afterEach(() => {
    mockServer.close();
    this.clock.restore();
  });

  describe('#addNewConnection', () => {
    it('should create new connection', (done) => {
      expect(this.incomingSocket).not.to.be.undefined;
      done();
    });

    it('should set socket', (done) => {
      const context = new Context('TEST1234');
      context.incomingSocket = new EventEmitter();
      context.incomingSocket.setSocket = spy();
      context.outgoingSocket = this.outgoingSocket;
      context.addNewConnection(this.socket, this.request);
      assert(context.incomingSocket.setSocket.calledOnce);
      done();
    });
  });

  describe('incomingWebSocket', () => {
    it('should emit connection opened', () => {
      this.incomingSocket.on(kConnectionOpened, () => {
        this.outgoingSocket.on(kDequeueMessage, () => {
          this.outgoingSocket.drainQueue = spy();
          assert(this.outgoingSocket.drainQueue.calledOnce);
        });
      });
      this.incomingSocket.emit(kConnectionOpened);
    });

    it('should queue messages', (done) => {
      this.incomingSocket.on(kMessageReceived, () => {
        assert(context.incomingLock);
        expect(this.incomingSocket.queue).to.not.be.empty;
      });
      this.incomingSocket.emit(kMessageReceived);
      done();
    });

    it('should send message', (done) => {
      context.outgoingSocket = new EventEmitter();
      context.incomingLock = false;
      this.incomingSocket.on(kMessageReceived, (msg) => {
        assert(context.incomingLock === false);
        assert(msg === 'message');
        this.outgoingSocket.on(kSendMessage, (msg) => {
          const sendSpy = spy();
          context.incomingSocket.send = sendSpy;
          assert(sendSpy.calledOnce);
          assert(msg === 'message');
        });
      });
      this.incomingSocket.emit(kMessageReceived, 'message');
      done();
    });

    it('should drain message', (done) => {
      context.outgoingSocket = new EventEmitter();
      this.incomingSocket.on(kDrainMessage, (msg) => {
        assert(msg === 'message');
        this.outgoingSocket.on(kSendMessage, (msg) => {
          const sendSpy = spy();
          context.outgoingSocket.send = sendSpy;
          assert(sendSpy.calledOnce);
          assert(msg === 'message');
        });
      });
      this.incomingSocket.emit(kDrainMessage, 'message');
      done();
    });

    it('should set incoming lock and send message proxy locked', (done) => {
      this.incomingSocket.on(kEnableOutgoingQueue, () => {
        assert(context.outgoingLock);
        this.incomingSocket.on(kSendMessage, (msg) => {
          const sendSpy = spy();
          context.incomingSocket.send = sendSpy;
          assert(sendSpy.calledOnce);
          assert(msg === 'PROXY_LOCKED');
        });
      });
      this.incomingSocket.emit(kEnableOutgoingQueue);
      done();
    });

    it('should emit event dequeue message', (done) => {
      const dequeueSpy = spy();
      this.incomingSocket.on(kDequeueMessage, dequeueSpy);
      this.incomingSocket.emit(kDequeueMessage);
      assert(dequeueSpy.calledOnce);
      done();
    });

    it('should send message', (done) => {
      const sendSpy = spy();
      this.incomingSocket.send = sendSpy;
      this.incomingSocket.on(kSendMessage, () => {
        assert(this.incomingSocket.send.calledOnce);
      });
      this.incomingSocket.emit(kSendMessage);
      done();
    });

    it('should close client', (done) => {
      this.incomingSocket.on(kClientClosed, (code, msg) => {
        this.outgoingSocket.on(kQueueMessage, () => {
          assert(context.incomingLock);
        });

        const closeSpy = spy();
        this.outgoingSocket.close = closeSpy;
        this.clock.tick(15000);
        expect(code).to.be.equal(1006);
        expect(msg).to.be.equal('CLOSED');
        assert(closeSpy.calledOnce);
      });

      this.incomingSocket.emit(kClientClosed, 1006, 'CLOSED');
      done();
    });

    it('should log error', () => {
      const errorSpy = spy();
      this.incomingSocket.on(kError, errorSpy);
      this.incomingSocket.emit(kError);
      assert(errorSpy.calledOnce);
    });
  });

  describe('outgoingWebsocket', () => {
    it('should release tap', (done) => {
      context.outgoingSocket.on(kReleaseTap, () => {
        this.incomingSocket.on(kDrainMessage, () => {
          const sendSpy = spy();
          this.outgoingSocket.send = sendSpy;
          this.outgoingSocket.on(kSendMessage, () => {
            assert(this.outgoingSocket.send.calledOnce);
          });
        });
        this.outgoingSocket.on(kDrainMessage, () => {
          const sendSpy = spy();
          this.incomingSocket.send = sendSpy;
          this.incomingSocket.on(kSendMessage, () => {
            assert(this.incomingSocket.send.calledOnce);
          });
        });

        expect(context.outgoingLock).to.be.equal(false);
        expect(context.incomingLock).to.be.equal(false);
      });
      this.outgoingSocket.emit(kReleaseTap);
      done();
    });

    it('should send message', (done) => {
      this.outgoingSocket.on(kMessageReceived, () => {
        expect(context.outgoingLock).to.be.equal(false);
      });
      this.outgoingSocket.emit(kMessageReceived);
      done();
    });

    it('should queue message', (done) => {
      this.outgoingSocket.on(kQueueMessage, () => {
        assert(context.outgoingLock);
        this.outgoingSocket.on(kMessageReceived, () => {
          assert(context.outgoingLock);
          expect(this.incomingSocket.queue).to.not.be.empty;
        });
        this.outgoingSocket.emit(kMessageReceived);
      });
      this.outgoingSocket.emit(kQueueMessage);

      done();
    });

    it('should log error', () => {
      const errorSpy = spy();
      this.outgoingSocket.on(kError, errorSpy);
      this.outgoingSocket.emit(kError);
      assert(errorSpy.calledOnce);
    });

    it('should set outgoing lock', (done) => {
      this.outgoingSocket.on(kQueueMessage, () => {
        assert(context.outgoingLock);
      });
      this.outgoingSocket.emit(kQueueMessage);
      done();
    });

    it('should set incoming lock and send message proxy locked', (done) => {
      context.outgoingSocket = new EventEmitter();
      this.outgoingSocket.on(kEnableIncomingQueue, () => {
        assert(context.incomingLock);
        this.outgoingSocket.on(kSendMessage, (msg) => {
          const sendSpy = spy();
          context.outgoingSocket.send = sendSpy;
          assert(sendSpy.calledOnce);
          assert(msg === 'PROXY_LOCKED');
        });
      });
      this.outgoingSocket.emit(kEnableIncomingQueue);
      done();
    });

    it('should send message', (done) => {
      const sendSpy = spy();
      this.outgoingSocket.send = sendSpy;
      this.outgoingSocket.on(kSendMessage, () => {
        assert(this.outgoingSocket.send.calledOnce);
      });
      this.outgoingSocket.emit(kSendMessage);
      done();
    });

    it('should emit event dequeue message', (done) => {
      const dequeueSpy = spy();
      this.outgoingSocket.on(kDequeueMessage, dequeueSpy);
      this.outgoingSocket.on(kDrainCompleted, () => {
        expect(context.outgoingLock).to.be.equal(false);
      });

      this.outgoingSocket.on(kDrainCompleted, () => {
        expect(context.outgoingLock).to.be.equal(false);
      });

      const sendSpy = spy();
      this.incomingSocket.send = sendSpy;
      this.incomingSocket.on(kSendMessage, () => {
        assert(this.incomingSocket.send.calledOnce);
      });
      this.outgoingSocket.emit(kQueueMessage);
      this.outgoingSocket.emit(kDequeueMessage);
      assert(dequeueSpy.calledOnce);
      done();
    });

    it('should emit drain message', (done) => {
      this.outgoingSocket.on(kDrainMessage, () => {
        this.incomingSocket.on(kSendMessage, (msg) => {
          const sendSpy = spy();
          this.incomingSocket.send = sendSpy;
          expect(msg).to.be.equal('DRAIN MESSAGE');
          assert(sendSpy.calledOnce);
          sendSpy.restore();
        });
      });
      this.outgoingSocket.emit(kDrainMessage, 'DRAIN MESSAGE');
      done();
    });

    it('should emit upstream restart', (done) => {
      this.outgoingSocket.on(kUpstreamRestart, (code, msg) => {
        expect(code).to.be.equal(1005);
        expect(msg).to.be.equal('Service Restart');
        this.incomingSocket.on(kQueueMessage, () => {
          assert(context.incomingLock);
        });
      });
      this.outgoingSocket.emit(kUpstreamRestart, 1005, 'Service Restart');
      done();
    });

    it('should emit upstream restart', (done) => {
      this.outgoingSocket.on(kAddNewContext, (connectionId) => {
        expect(connectionId).to.be.equal('NEW_CONNECTION_ID');
      });
      this.outgoingSocket.emit(kAddNewContext, 'NEW_CONNECTION_ID');
      done();
    });
  });

  describe('#setConnectionId', () => {
    it('should set connection id', () => {
      context.setConnectionId('NEW_CONNECTION_ID');
      expect(context.connectionId).to.be.equal('NEW_CONNECTION_ID');
    });
  });
});
