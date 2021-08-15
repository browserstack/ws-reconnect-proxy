const WebSocket = require('ws');
const { expect, assert } = require('chai');
const { spy } = require('sinon');
const { describe, beforeEach, before, it, after } = require('mocha');
const IncomingWebSocket = require('../../lib/core/IncomingWebSocket');
const Queue = require('../../lib/core/Queue');
const {
	kConnectionOpened,
	kMessageReceived,
	kError,
	kClientClosed,
	kDrainMessage,
	kDrainCompleted,
	kQueueMessage,
} = require('../../lib/config/constants');

describe('IncomingWebSocket', () => {
	let mockSocket, incomingWs, newMockServer, newMockSocket;

	before(() => {
		mockSocket = new WebSocket('ws://localhost:6666');
		incomingWs = new IncomingWebSocket(mockSocket, 'requestData');
	});

	describe('#constructor', () => {
		it('should set initial values in constructor', () => {
			expect(incomingWs.socket).to.equal(mockSocket);
			expect(incomingWs.request).to.equal('requestData');
			expect(incomingWs.queue).to.be.an.instanceof(Queue);
			expect(incomingWs.teardown).to.equal(false);
		});
	});

	describe('#registerListeners', () => {
		it('should call open handler', () => {
			incomingWs.on('open', () => {
				const openSpy = spy();
				incomingWs.openHandler = openSpy;
				assert(openSpy.calledOnce);
			});
		});

		it('should call message handler', () => {
			incomingWs.on('message', () => {
				const messageSpy = spy();
				incomingWs.messageHandler = messageSpy;
				assert(messageSpy.calledOnce);
			});
		});

		it('should call close handler', () => {
			incomingWs.on('close', () => {
				const closeSpy = spy();
				incomingWs.closeHandler = closeSpy;
				assert(closeSpy.calledOnce);
			});
		});

		it('should call error handler', () => {
			incomingWs.on('error', () => {
				const errorSpy = spy();
				incomingWs.errorHandler = errorSpy;
				assert(errorSpy.calledOnce);
			});
		});
	});

	describe('#setSocket', () => {
		newMockServer = new WebSocket.Server({ port: 7777 });
		newMockSocket = new WebSocket('ws://localhost:7777');

		it('should call registerListeners', () => {
			const registerSpy = spy();
			incomingWs.registerListeners = registerSpy;
			incomingWs.setSocket(newMockSocket, 'new request');
			assert(registerSpy.calledOnce);
		});

		it('should update the socket with new socket', () => {
			expect(incomingWs.socket).to.not.equal(mockSocket);
			expect(incomingWs.socket).to.equal(newMockSocket);
		});

		it('should update the request with new request', () => {
			expect(incomingWs.request).to.not.equal('requestData');
			expect(incomingWs.request).to.equal('new request');
		});
	});

	describe('#addToQueue', () => {
		it('should increase length of queue by one', () => {
			const prevLen = incomingWs.queue.size();
			incomingWs.addToQueue('Some Mesg');
			expect(incomingWs.queue.size()).to.equal(prevLen + 1);
		});
	});

	describe('#send(msg)', () => {
		it('should send the message on incoming socket', () => {
			const mesgSpy = spy();
			incomingWs.socket.send = mesgSpy;
			incomingWs.send('sample mesg');
			assert(mesgSpy.calledOnce);
			assert(mesgSpy.calledWith('sample mesg'));
		});
	});

	describe('#drainQueue', () => {
		let drainSpy;
		beforeEach(() => {
			drainSpy = spy();
			incomingWs.emit = drainSpy;
		});

		it('should emit kDrainMessage while queue is not empty', () => {
			incomingWs.drainQueue();
			assert(drainSpy.calledWith(kDrainMessage));
		});

		it('should emit total of (queue length + 1) messages', () => {
			incomingWs.queue.enqueue('Second Mesg');
			incomingWs.queue.enqueue('Third Mesg');
			const len = incomingWs.queue.size();
			incomingWs.drainQueue();
			expect(drainSpy.callCount).to.equal(len + 1);
		});

		it('should emit kDrainCompleted once when queue empty', () => {
			while (!incomingWs.queue.isEmpty()) {
				incomingWs.queue.deque();
			}
			incomingWs.drainQueue();
			assert(drainSpy.calledOnce);
			assert(drainSpy.calledWith(kDrainCompleted));
		});
	});

	describe('#close', () => {
		let terminateSpy;
		before(() => {
			terminateSpy = spy();
			incomingWs.socket.terminate = terminateSpy;
			incomingWs.close();
		});

		it('should terminate the websocket', () => {
			assert(terminateSpy.calledOnce);
		});

		it('should set teardown to true', () => {
			expect(incomingWs.teardown).to.equal(true);
		});
	});

	describe('#errorHandler', () => {
		it('should emit kError once', () => {
			const emitSpy = spy();
			incomingWs.emit = emitSpy;
			incomingWs.errorHandler();
			assert(emitSpy.calledOnce);
			assert(emitSpy.calledWith(kError));
		});
	});

	describe('#messageHandler(msg)', () => {
		it('should emit kMessageReceived', () => {
			const emitSpy = spy();
			incomingWs.emit = emitSpy;
			incomingWs.messageHandler('new mesg');
			assert(emitSpy.calledOnce);
			assert(emitSpy.calledWith(kMessageReceived, 'new mesg'));
		});

		it('should emit kQueueMessage', () => {
			const emitSpy = spy();
			incomingWs.emit = emitSpy;
			incomingWs.messageHandler('PROXY_RESTART');
			assert(emitSpy.calledOnce);
			assert(emitSpy.calledWith(kQueueMessage));
		});
	});

	describe('#closeHandler(code, msg)', () => {
		let emitSpy;
		beforeEach(() => {
			emitSpy = spy();
			incomingWs.emit = emitSpy;
		});

		it('should emit kClientClosed if teardown is false', () => {
			incomingWs.teardown = false;
			incomingWs.closeHandler(1001, 'closing');
			assert(emitSpy.calledOnce);
			assert(emitSpy.calledWith(kClientClosed, 1001, 'closing'));
		});

		it('should emit not kClientClosed if teardown is true', () => {
			incomingWs.teardown = true;
			incomingWs.closeHandler(1001, 'closing');
			expect(emitSpy.callCount).to.equal(0);
		});
	});

	describe('#openHandler()', () => {
		it('should emit kConnectionOpened once', () => {
			const emitSpy = spy();
			incomingWs.emit = emitSpy;
			incomingWs.openHandler();
			assert(emitSpy.calledOnce);
			assert(emitSpy.calledWith(kConnectionOpened));
		});
	});

	after(() => {
		newMockServer.close();
		mockSocket.close();
		newMockSocket.close();
	});
});
