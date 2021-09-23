const { describe, beforeEach, before, it } = require('mocha');
const { expect, assert } = require('chai');
const { spy } = require('sinon');
const Queue = require('../../lib/core/Queue');
const OutgoingWebSocket = require('../../lib/core/OutgoingWebSocket');
const {
  config,
  kConnectionOpened,
  kAddNewContext,
  kReleaseTap,
  kMessageReceived,
  kUpstreamRestart,
  kUpstreamClosed,
  kDrainMessage,
  kDrainCompleted,
  SERVICE_RESTART,
  RECONNECT,
  kEnableIncomingQueue,
} = require('../../lib/config/constants');
const utilFn = require('../../lib/util/util');

describe('OutgoingWebSocket', () => {
  let outgoingWs, upstreamUrl, headers;
  before(() => {
    upstreamUrl = 'ws://localhost:7423/';
    headers = {};
    outgoingWs = new OutgoingWebSocket(upstreamUrl, headers);
  });

  describe('#constructor(url, headers)', () => {
    it('should set initial values in constructor', () => {
      expect(outgoingWs.url).to.equal(upstreamUrl);
      expect(outgoingWs.shouldRetry).to.equal(false);
      expect(outgoingWs.socket).to.equal(null);
      expect(outgoingWs.reconnectInfo).to.equal(null);
      expect(outgoingWs.queue).to.be.an.instanceof(Queue);
      expect(outgoingWs.retryCount).to.equal(config.retryVal);
    });
  });

  describe('#registerListeners', () => {
    it('should call open handler', () => {
      outgoingWs.on('open', () => {
        const openSpy = spy();
        outgoingWs.openHandler = openSpy;
        assert(openSpy.calledOnce);
      });
    });

    it('should call message handler', () => {
      outgoingWs.on('message', () => {
        const messageSpy = spy();
        outgoingWs.messageHandler = messageSpy;
        assert(messageSpy.calledOnce);
      });
    });

    it('should call close handler', () => {
      outgoingWs.on('close', () => {
        const closeSpy = spy();
        outgoingWs.closeHandler = closeSpy;
        assert(closeSpy.calledOnce);
      });
    });

    it('should call error handler', () => {
      outgoingWs.on('error', () => {
        const errorSpy = spy();
        outgoingWs.errorHandler = errorSpy;
        assert(errorSpy.calledOnce);
      });
    });
  });

  describe('#openHandler', () => {
    it('should send reconnectInfo if it is not null', () => {
      const sendSpy = spy();
      outgoingWs.send = sendSpy;
      outgoingWs.reconnectInfo = 'not null';
      outgoingWs.openHandler();
      assert(sendSpy.calledOnce);
      assert(sendSpy.calledWith('not null'));
    });

    it('should not send reconnectInfo if null', () => {
      const sendSpy = spy();
      outgoingWs.send = sendSpy;
      outgoingWs.reconnectInfo = null;
      outgoingWs.openHandler();
      expect(sendSpy.callCount).to.equal(0);
    });

    it('should emit kConnectionOpened once', () => {
      const emitSpy = spy();
      outgoingWs.emit = emitSpy;
      outgoingWs.openHandler();
      assert(emitSpy.calledOnce);
      assert(emitSpy.calledWith(kConnectionOpened));
    });

    it('should set shouldRetry to false', () => {
      outgoingWs.shouldRetry = true;
      outgoingWs.openHandler();
      expect(outgoingWs.shouldRetry).to.equal(false);
    });

    it('should set retryCount to config.retryVal', () => {
      outgoingWs.retryCount = 'not config retry value';
      outgoingWs.openHandler();
      expect(outgoingWs.retryCount).to.equal(config.retryVal);
    });
  });

  describe('#messageHandler', () => {
    it('should emit only kMessageReceived once if mesg is null', () => {
      const msgSpy = spy();
      outgoingWs.emit = msgSpy;
      outgoingWs.messageHandler(null);
      assert(msgSpy.calledOnce);
      assert(msgSpy.calledWith(kMessageReceived, null));
    });

    it('should emit only kMessageReceived once if mesg is undefined', () => {
      const msgSpy = spy();
      outgoingWs.emit = msgSpy;
      outgoingWs.messageHandler(undefined);
      assert(msgSpy.calledOnce);
      assert(msgSpy.calledWith(kMessageReceived, undefined));
    });

    it('should emit only kMessageReceived once if message is not RECONNECT', () => {
      const msgSpy = spy();
      outgoingWs.emit = msgSpy;
      outgoingWs.messageHandler('some message');
      assert(msgSpy.calledOnce);
      assert(msgSpy.calledWith(kMessageReceived, 'some message'));
    });

    it('should not update reconnectInfo in case message is not RECONNECT', () => {
      outgoingWs.reconnectInfo = 'existing';
      outgoingWs.messageHandler(null);
      expect(outgoingWs.reconnectInfo).to.equal('existing');
    });

    it('should update reconnectInfo in case message is RECONNECT', () => {
      outgoingWs.reconnectInfo = 'existing';
      outgoingWs.messageHandler(RECONNECT);
      expect(outgoingWs.reconnectInfo).to.equal(RECONNECT);
    });

    it('should emit kAddNewContext, kReleaseTap in case message is RECONNECT', () => {
      const msgSpy = spy();
      outgoingWs.emit = msgSpy;
      outgoingWs.connectionId = '123';
      outgoingWs.messageHandler(RECONNECT);
      assert(msgSpy.calledTwice);
      assert(msgSpy.calledWith(kAddNewContext, '123'));
      assert(msgSpy.calledWith(kReleaseTap));
    });

    it('should not emit kMessageReceived in case message is RECONNECT', () => {
      const msgSpy = spy();
      outgoingWs.emit = msgSpy;
      outgoingWs.connectionId = '123';
      outgoingWs.messageHandler(RECONNECT);
      assert(msgSpy.calledTwice);
      expect(msgSpy.calledWith(kMessageReceived)).to.equal(false);
    });

    it('should emit kEnableIncomingQueue', () => {
      const emitSpy = spy();
      outgoingWs.emit = emitSpy;
      outgoingWs.messageHandler('PROXY_RESTART');
      assert(emitSpy.calledOnce);
      assert(emitSpy.calledWith(kEnableIncomingQueue));
    });
  });

  describe('#closeHandler', () => {
    const retrySpy = spy();
    const emitSpy = spy();
    beforeEach(() => {
      outgoingWs.startRetries = retrySpy;
      outgoingWs.emit = emitSpy;
    });

    it('should not emit anything is shouldRetry is true', () => {
      outgoingWs.shouldRetry = true;
      outgoingWs.closeHandler(1001, 'close message');
      expect(retrySpy.callCount).to.equal(0);
      expect(emitSpy.callCount).to.equal(0);
    });

    it('should emit kUpstreamClosed if shouldRetry false and msg is not SERVICE_RESTART', () => {
      outgoingWs.shouldRetry = false;
      outgoingWs.closeHandler(1001, 'not SERVICE_RESTART');
      assert(emitSpy.calledOnce);
      assert(emitSpy.calledWith(kUpstreamClosed, 1001, 'not SERVICE_RESTART'));
    });

    it('should not update shouldRetry if shouldRetry false and msg is not SERVICE_RESTART', () => {
      outgoingWs.shouldRetry = false;
      outgoingWs.closeHandler(1001, 'not SERVICE_RESTART');
      expect(outgoingWs.shouldRetry).to.equal(false);
    });

    it('should  update shouldRetry if shouldRetry false and msg === SERVICE_RESTART', () => {
      outgoingWs.shouldRetry = false;
      outgoingWs.closeHandler(1001, SERVICE_RESTART);
      expect(outgoingWs.shouldRetry).to.equal(true);
    });

    it('should emit kUpstreamRestart if shouldRetry false and msg === SERVICE_RESTART', () => {
      const eSpy = spy();
      outgoingWs.emit = eSpy;
      outgoingWs.shouldRetry = false;
      outgoingWs.closeHandler(1001, SERVICE_RESTART);
      assert(eSpy.calledOnce);
      assert(eSpy.calledWith(kUpstreamRestart, 1001, SERVICE_RESTART));
    });
  });

  describe('#errorHandler', () => {
    it('should emit kError', () => {
      const errSpy = spy();
      outgoingWs.emit = errSpy;
      outgoingWs.errorHandler('SOME ERROR');
      assert(errSpy.calledOnce);
    });
  });

  describe('#addToQueue', () => {
    it('should increase length of queue by one', () => {
      const prevLen = outgoingWs.queue.size();
      outgoingWs.addToQueue('Some Mesg');
      expect(outgoingWs.queue.size()).to.equal(prevLen + 1);
    });
  });

  describe('#drainQueue', () => {
    let drainSpy;
    beforeEach(() => {
      drainSpy = spy();
      outgoingWs.emit = drainSpy;
    });

    it('should emit kDrainMessage while queue is not empty', () => {
      outgoingWs.drainQueue();
      assert(drainSpy.calledWith(kDrainMessage));
    });

    it('should emit total of (queue length + 1) messages', () => {
      outgoingWs.queue.enqueue('Second Mesg');
      outgoingWs.queue.enqueue('Third Mesg');
      const len = outgoingWs.queue.size();
      outgoingWs.drainQueue();
      expect(drainSpy.callCount).to.equal(len + 1);
    });

    it('should emit kDrainCompleted once when queue empty', () => {
      while (!outgoingWs.queue.isEmpty()) {
        outgoingWs.queue.deque();
      }
      outgoingWs.drainQueue();
      assert(drainSpy.calledOnce);
      assert(drainSpy.calledWith(kDrainCompleted));
    });
  });

  describe('#setConnectionId', () => {
    it('should call util extractConnectionId method', () => {
      const extractIdFun = spy(utilFn, 'extractConnectionId');
      outgoingWs.headers = {
        'x-connection-id': '123_id',
      };
      outgoingWs.setConnectionId();
      expect(extractIdFun.calledOnce);
    });

    it('should update connectionId', () => {
      outgoingWs.connectionId = 'old_id';
      outgoingWs.headers = {
        'x-connection-id': 'new_id',
      };
      outgoingWs.setConnectionId();
      expect(outgoingWs.connectionId).to.eq('new_id');
    });
  });

  describe('#setHeaders', () => {
    it('should remove disallowed headers and set the headers', () => {
      const headers = {
        host: 'localhost',
        connection: 'some-connection',
        'sec-websocket-key': 'some-key-123',
        'sec-websocket-version': 'some-version-1.0.0',
        upgrade: 'false',
        notdisallowed: 'should remain',
      };
      outgoingWs.setHeaders(headers);
      expect(outgoingWs.headers).to.be.an.instanceof(Object);
      expect(outgoingWs.headers['notdisallowed']).to.equal('should remain');
    });
  });
});
