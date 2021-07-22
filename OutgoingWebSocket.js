'use strict';

const EventEmitter = require('events');
const WebSocket = require('ws');
const Queue = require('./queue.js');
const { promisify } = require('util');
const logger = require('./loggerFactory.js');
const sleep = promisify(setTimeout);
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
  DISALLOWED_HEADERS
} = require('./constants.js');

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
    this.shouldRetry = false;
    this.socket = null;
    this.url = url;
    DISALLOWED_HEADERS.forEach(h => delete headers[h]);
    this.headers = headers;
    this.queue = new Queue();
    this.retryCount = config.retryVal;
  }

  /**
   * Adds the Outgoing socket & registers the listeners
   */
  addSocket() {
    logger.debug(`Trying to connect with socket: ${this.url}`);
    this.socket = new WebSocket(this.url, {
      headers: this.headers
    });
    this.registerListeners();
  }

  /**
   * Registers the socket listeners.
   */
  registerListeners(){
    this.socket.on('open', this.openHandler.bind(this));
    this.socket.on('message', this.messageHandler.bind(this));
    this.socket.on('close', this.connectionClosed.bind(this));
    this.socket.on('error', this.errorHandler.bind(this));
  }

  /**
   * Triggers when socket connection is opened.
   */
  openHandler() {
    if (this.shouldRetry) {
      this.send(this.reconnectInfo);
    }
    this.emit(kConnectionOpened);
    this.shouldRetry = false;
  }

  /**
   * Triggers when message is received on socket.
   *
   * @param {string} msg
   */
  messageHandler(msg) {
    if (msg.substring(0, 9) === RECONNECT) {
      this.reconnectInfo = msg;
      this.emit(kAddNewContext, this.getConnectionId());
      this.emit(kReleaseTap);
      return;
    }
    logger.debug(`Received message on outgoing socket: ${msg}`);
    this.emit(kMessageReceived, msg);
  }

  /**
   * Gets the connection id.
   *
   * @returns {string}
   */
  getConnectionId() {
    const reconnectData = this.reconnectInfo.substring(10, this.reconnectInfo.length);
    try {
      const reconnectParsed = JSON.parse(reconnectData);
      return reconnectParsed.connectionId;
    } catch (error) {
      logger.error(error);
    }
  }


  /**
   * Triggers when socket connection is closed.
   *
   * @param {number} code
   * @param {string} msg
   */
  closeHandler(code, msg) {
    logger.debug(`Received Closed : ${code} - ${msg}`);
    if (!this.shouldRetry) {
      if (msg === SERVICE_RESTART) {
        this.shouldRetry = true;
        this.emit(kUpstreamRestart, code, msg);
        this.startRetries(code, msg);
      }
      else
        this.emit(kUpstreamClosed, code, msg);
    } else {
      this.startRetries(code, msg);
    }
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
        this.emit(kUpstreamClosed);
      } else {
        this.retryCount = this.retryCount - 1;
        await sleep(config.retryDelayVal);
        logger.debug(`Retries left: ${this.retryCount}`);
        this.addSocket();
      }
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
   * Triggers when error occured on socket.
   */
  errorHandler() {
    logger.error("Error occured in outgoing socket!")
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
}

module.exports = OutgoingWebSocket;
