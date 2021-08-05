'use strict';

const EventEmitter = require('events');
const WebSocket = require('ws');
const Queue = require('./Queue');
const { promisify } = require('util');
const logger = require('./loggerFactory');
const sleep = promisify(setTimeout);
const {
	config,
	kConnectionOpened,
	kAddNewContext,
	kReleaseTap,
	kMessageReceived,
	kError,
	kUpstreamRestart,
	kUpstreamClosed,
	kDrainMessage,
	kDrainCompleted,
	SERVICE_RESTART,
	RECONNECT,
	DISALLOWED_HEADERS,
	OUTGOING,
} = require('./constants');
const { extractConnectionId } = require('./util');

/**
 * Outgoing WebSocket connection is the connection object
 * to the upstream server. Each upstream will have a unique
 * client connection (IncomingWebSocket edge). This is a general
 * abstraction over WebSocket so that custom events can be emitted
 * on the object itself and the implementation can be handled in the
 * class member function itself.
 */
class OutgoingWebSocket extends EventEmitter {
	constructor(url, headers) {
		super();
		this.url = url;
		this.setHeaders(headers);
		this.setConnectionId();
		this.shouldRetry = false;
		this.socket = null;
		this.reconnectInfo = null;
		this.queue = new Queue();
		this.retryCount = config.retryVal;
	}

	/**
	 * Adds the Outgoing socket & registers the listeners
	 */
	addSocket() {
		logger.debug(`Trying to connect with socket: ${this.url}`);
		this.socket = new WebSocket(this.url, {
			headers: {
				...this.headers,
				...(this.reconnectInfo !== null && { 'x-reconnect': true }),
			},
		});
		this.registerListeners();
	}

	/**
	 * Registers the socket listeners.
	 */
	registerListeners() {
		this.socket.on('open', this.openHandler.bind(this));
		this.socket.on('message', this.messageHandler.bind(this));
		this.socket.on('close', this.closeHandler.bind(this));
		this.socket.on('error', this.errorHandler.bind(this));
	}

	/**
	 * Triggers when socket connection is opened.
	 */
	openHandler() {
		if (this.reconnectInfo !== null) {
			logger.debug(
				`${OUTGOING} [${this.connectionId}] [RECONNECT] - ${this.reconnectInfo}`
			);
			this.send(this.reconnectInfo);
		}
		this.emit(kConnectionOpened);
		this.shouldRetry = false;
		this.retryCount = config.retryVal;
	}

	/**
	 * Triggers when message is received on socket.
	 *
	 * @param {string} msg
	 */
	messageHandler(msg) {
		if (
			msg != null &&
			msg != undefined &&
			msg != '' &&
			msg.substring(0, 9) === RECONNECT
		) {
			this.reconnectInfo = msg;
			this.emit(kAddNewContext, this.connectionId);
			this.emit(kReleaseTap);
			return;
		}
		this.emit(kMessageReceived, msg);
	}

	/**
	 * Triggers when socket connection is closed.
	 *
	 * @param {number} code
	 * @param {string} msg
	 */
	closeHandler(code, msg) {
		if (!this.shouldRetry) {
			if (msg === SERVICE_RESTART) {
				this.shouldRetry = true;
				this.emit(kUpstreamRestart, code, msg);
				this.startRetries(code, msg);
			} else {
				this.emit(kUpstreamClosed, code, msg);
			}
		}
	}

	/**
	 * Triggers when error occured on socket.
	 */
	errorHandler() {
		this.emit(kError);
	}

	/**
	 * Retries upstream socket until max retries reached.
	 *
	 * @param {number} code
	 * @param {string} msg
	 */
	async startRetries(code, msg) {
		if (this.shouldRetry) {
			if (this.retryCount == 0) {
				this.emit(kUpstreamClosed, code, msg);
			} else {
				this.retryCount = this.retryCount - 1;
				await sleep(config.retryDelayVal);
				this.addSocket();
			}
			logger.debug(
				`${OUTGOING} [${this.connectionId}] [RETRIES LEFT: ${this.retryCount}] `
			);
		}
	}

	/**
	 *  Closes the socket connection.
	 */
	close() {
		this.socket.close();
	}

	/**
	 * Adds message to queue.
	 *
	 * @param {string} msg
	 */
	addToQueue(msg) {
		this.queue.enqueue(msg);
	}

	/**
	 * Sends the message on socket.
	 *
	 * @param {string} msg
	 */
	send(msg) {
		this.socket.send(msg);
	}

	/**
	 * Drains the queue and emits completed event.
	 */
	drainQueue() {
		while (!this.queue.isEmpty()) {
			this.emit(kDrainMessage, this.queue.dequeue());
		}
		this.emit(kDrainCompleted);
	}

	/**
	 * Sets connection identifier from headers
	 */
	setConnectionId() {
		this.connectionId = extractConnectionId(this.headers);
	}

	/**
	 * Sets the headers and sanitises it.
	 *
	 * @param {object} headers
	 */
	setHeaders(headers) {
		DISALLOWED_HEADERS.forEach((h) => delete headers[h]);
		this.headers = headers;
	}
}

module.exports = OutgoingWebSocket;
