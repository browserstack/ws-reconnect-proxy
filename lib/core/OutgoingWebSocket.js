'use strict';

const EventEmitter = require('events');
const WebSocket = require('ws');
const Queue = require('./Queue');
const { promisify } = require('util');
const logger = require('../util/loggerFactory');
const sleep = promisify(setTimeout);
const {
  config,
  kConnectionOpened,
  kEnableIncomingQueue,
  kAddNewContext,
  kReleaseTap,
  kMessageReceived,
  kPingReceived,
  kError,
  kUpstreamRestart,
  kUpstreamClosed,
  kDrainMessage,
  kDrainCompleted,
  SERVICE_RESTART,
  RECONNECT,
  PROXY_RESTART,
  DISALLOWED_HEADERS,
  OUTGOING,
  customRequestEnabled
} = require('../config/constants');
const { extractConnectionId } = require('../util/util');
const { incrReconnectionCount } = require('../util/metrics');
const { isNotUndefined } = require('../util/typeSanity');
const CustomRequestHandler = require('./CustomRequestHandler')

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
    logger.info(`Trying to connect with socket: ${this.url}`);
    this.socket = new WebSocket(this.url, {
      headers: {
        ...this.headers,
        ...(isNotUndefined(this.reconnectInfo) && { 'x-reconnect': true }),
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
    this.socket.on('ping', this.pingHandler.bind(this));
  }

  /**
   * Triggers when socket connection is opened.
   */
  openHandler() {
    if (isNotUndefined(this.reconnectInfo)) {
      logger.info(
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
    if (isNotUndefined(msg) && msg.substring(0, 9) === RECONNECT) {
      incrReconnectionCount();
      this.reconnectInfo = msg;
      this.emit(kAddNewContext, this.connectionId);
      this.emit(kReleaseTap);
      return;
    }
    if (msg === PROXY_RESTART) {
      this.emit(kEnableIncomingQueue);
      return;
    }

    if(customRequestEnabled) {
      const customReqInstance = CustomRequestHandler.getInstance();
      let resp;
      try {
        resp = JSON.parse(msg);
        if (resp && customReqInstance.getList().hasOwnProperty(resp.id)) {
          customReqInstance.customRequestList[resp.id].resolve(msg)
          return;
        }
      } catch (error) {
        logger.error(`Error parsing JSON: ${error}`);
      }
    }
    this.emit(kMessageReceived, msg);
  }

  pingHandler() {
    this.emit(kPingReceived);
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
  errorHandler(error) {
    if(customRequestEnabled) {
      const customReqInstance = CustomRequestHandler.getInstance();
      let resp;
      try {
        resp = JSON.parse(msg);
        if (resp && customReqInstance.getList().hasOwnProperty(resp.id)) {
          customReqInstance.customRequestList[resp.id].reject(error)
          return;
        }
      } catch (error) {
        logger.error(`Error parsing JSON: ${error}`);
      }
    }
    this.emit(kError, error);
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
      logger.info(
        `${OUTGOING} [${this.connectionId}] [RETRIES LEFT: ${this.retryCount}] `
      );
    }
  }

  /**
   *  Closes the socket connection.
   */
  close(code, msg) {
    if (code == 1006)
      this.socket.terminate();
    else if (code == 1005)
      this.socket.close();
    else
      this.socket.close(code, msg);
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
