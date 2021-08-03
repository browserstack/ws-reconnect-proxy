'use strict';

const EventEmitter = require('events');
const IncomingWebSocket = require('./IncomingWebSocket');
const OutgoingWebSocket = require('./OutgoingWebSocket');
const logger = require('./loggerFactory');
const { createTarget } = require('./util');
const {
	kUpstreamClosed,
	kStartConnection,
	kMessageReceived,
	kError,
	kSendMessage,
	kQueueMessage,
	kDrainMessage,
	kConnectionOpened,
	kDequeueMessage,
	kClientClosed,
	kCleanup,
	kDrainCompleted,
	kReleaseTap,
	kAddNewContext,
	kUpstreamRestart,
	config,
	INCOMING,
	OUTGOING
} = require('./constants');

/**
 * Context holds the information for the incoming and outgoing sockets.
 *
 * Instantiates the incoming and outgoing sockets and registers the listeners.
 * Acts as a bridge between incoming and outgoing sockets.
 */
class Context extends EventEmitter {

	/**
   * Creates the context with connection identifier.
   *
   * @param {string} connectionId
   */
	constructor(connectionId) {
		super();
		this.connectionId = connectionId;
		this.incomingSocket = null;
		this.outgoingSocket = null;
		this.incomingLock = true;
		this.outgoingLock = false;
	}

	/**
   * Adds a new incoming and outgoing connection.
   *
   * @param {WebSocket} socket
   * @param {object} request
   */
	addNewConnection(socket, request) {
		const prevIncomingSocket = this.incomingSocket === null;
		if (prevIncomingSocket) {
			this.incomingSocket = new IncomingWebSocket(socket, request);
			this.outgoingSocket = new OutgoingWebSocket(createTarget(request.url), request.headers);
			this.outgoingSocket.addSocket();
			this.registerIncomingListeners();
			this.registerOutgoingListeners();
			this.incomingSocket.emit(kStartConnection);
		} else {
			this.incomingSocket.setSocket(socket, request);
			this.outgoingSocket.emit(kDequeueMessage);
			clearTimeout(this.upstreamCloseTimer);
			this.upstreamCloseTimer = null;
		}
	}

	/**
   * Registers the incoming socket listeners.
   */
	registerIncomingListeners() {
		this.incomingSocket.on(kMessageReceived, msg => {
			if (this.incomingLock) {
				logger.debug(`${INCOMING} [${this.connectionId}] [QUEUE] - ${msg}`);
				this.incomingSocket.addToQueue(msg);
			}
			else
				this.outgoingSocket.emit(kSendMessage, msg);
		});

		this.incomingSocket.on(kError, () => {
			logger.error(`${INCOMING} [${this.connectionId}] [ERROR]`);
		});

		this.incomingSocket.on(kQueueMessage, () => {
			this.incomingLock = true;
			logger.debug(`${INCOMING} [${this.connectionId}] [QUEUE] - STARTED`);
		});

		this.incomingSocket.on(kSendMessage, msg => {
			this.incomingSocket.send(msg);
			logger.debug(`${INCOMING} [${this.connectionId}] [MESSAGE] - ${msg}`);
		});

		this.incomingSocket.on(kDrainMessage, msg => {
			this.outgoingSocket.emit(kSendMessage, msg);
		});

		this.incomingSocket.on(kConnectionOpened, () => {
			if (this.upstreamCloseTimer != null) {
				clearTimeout(this.upstreamCloseTimer);
				this.upstreamCloseTimer = null;
			}
			this.outgoingSocket.emit(kDequeueMessage);
			logger.debug(`${INCOMING} [${this.connectionId}] [OPEN]`);
		});

		this.incomingSocket.on(kClientClosed, (code, msg) => {
			logger.debug(`${INCOMING} [${this.connectionId}] [CLOSE] - Socket closed with ${code} and ${msg}`);
			this.outgoingSocket.emit(kQueueMessage);
			this.upstreamCloseTimer = setTimeout(this.closingOutgoingSocket.bind(this), config.closeTimer);
		});

		this.incomingSocket.on(kDequeueMessage, () => {
			this.incomingSocket.drainQueue();
		});

		this.incomingSocket.on(kDrainCompleted, () => {
			if (this.incomingLock) {
				this.incomingLock = false;
				logger.debug(`${INCOMING} [${this.connectionId}] [QUEUE] - COMPLETED`);
			}
		});
	}

	/**
   * Registers the outgoing socket listeners.
   */
	registerOutgoingListeners() {
		this.outgoingSocket.on(kReleaseTap, () => {
			this.incomingSocket.drainQueue();
			this.outgoingSocket.drainQueue();
		});

		this.outgoingSocket.on(kAddNewContext, connectionId => {
			this.emit(kAddNewContext, connectionId);
		});

		this.outgoingSocket.on(kMessageReceived, msg => {
			if (this.outgoingLock) {
				logger.debug(`${OUTGOING} [${this.connectionId}] [QUEUE] - ${msg}`);
				this.outgoingSocket.addToQueue(msg);
			}
			else
				this.incomingSocket.emit(kSendMessage, msg);
		});

		this.outgoingSocket.on(kError, () => {
			logger.error(`${OUTGOING} [${this.connectionId}] [ERROR]`);
		});

		this.outgoingSocket.on(kQueueMessage, () => {
			this.outgoingLock = true;
			logger.debug(`${OUTGOING} [${this.connectionId}] [QUEUE] - STARTED`);
		});

		this.outgoingSocket.on(kSendMessage, msg => {
			this.outgoingSocket.send(msg);
			logger.debug(`${OUTGOING} [${this.connectionId}] [MESSAGE] - ${msg}`);
		});

		this.outgoingSocket.on(kDequeueMessage, () => {
			this.outgoingSocket.drainQueue();
		});

		this.outgoingSocket.on(kUpstreamClosed, (code, msg) => {
			this.incomingSocket.close();
			this.emit(kCleanup, this.connectionId);
			logger.debug(`${OUTGOING} [${this.connectionId}] [CLOSE] - Socket closed with ${code} and ${msg}`);
		});

		this.outgoingSocket.on(kUpstreamRestart, (code, msg) => {
			this.incomingSocket.emit(kQueueMessage);
			logger.debug(`${OUTGOING} [${this.connectionId}] [RESTART] ${code} - ${msg}`);
		});

		this.outgoingSocket.on(kConnectionOpened, () => {
			this.incomingSocket.emit(kDequeueMessage);
			logger.debug(`${OUTGOING} [${this.connectionId}] [OPEN] `);
		});

		this.outgoingSocket.on(kDrainMessage, msg => {
			this.incomingSocket.emit(kSendMessage, msg);
		});

		this.outgoingSocket.on(kDrainCompleted, () => {
			if (this.outgoingLock) {
				this.outgoingLock = false;
				logger.debug(`${OUTGOING} [${this.connectionId}] [QUEUE]- COMPLETED`);
			}
		});
	}

	/**
 * Closes outgoing socket and emits clean up event.
 */
	closingOutgoingSocket() {
		this.outgoingSocket.close();
		this.emit(kCleanup, this.connectionId);
	}

	/**
   * Sets the connection id.
   *
   * @param {string} connectionId
   */
	setConnectionId(connectionId) {
		this.connectionId = connectionId;
	}
}

module.exports = Context;
