'use strict';

const EventEmitter = require('events');
const IncomingWebSocket = require('./IncomingWebSocket');
const OutgoingWebSocket = require('./OutgoingWebSocket');
const logger = require('../util/loggerFactory');
const { createTarget } = require('../util/util');
const {
  kUpstreamClosed,
  kMessageReceived,
  kPingReceived,
  kSendPing,
  kEnableIncomingQueue,
  kEnableOutgoingQueue,
  kError,
  PROXY_LOCKED,
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
  OUTGOING,
} = require('../config/constants');
const { isUndefined, isNotUndefined } = require('../util/typeSanity');
const {
  incrClosedConnectionCount,
  decrActiveConnectionCount,
  incrErrorConnectionCount,
  incrNewConnect,
  incrActiveConnectionCount,
} = require('../util/metrics');

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
    if (isUndefined(this.incomingSocket)) {
      this.incomingSocket = new IncomingWebSocket(socket, request);
      this.outgoingSocket = new OutgoingWebSocket(
        createTarget(request.url),
        request.headers
      );
      this.outgoingSocket.addSocket();
      this.registerIncomingListeners();
      this.registerOutgoingListeners();
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
    this.incomingSocket.on(kMessageReceived, (msg) => {
      if (this.incomingLock) {
        logger.debug(`${INCOMING} [${this.connectionId}] [QUEUE] - ${msg}`);
        this.incomingSocket.addToQueue(msg);
      } else this.outgoingSocket.emit(kSendMessage, msg);
    });

    this.incomingSocket.on(kError, (error) => {
      logger.error(`${INCOMING} [${this.connectionId}] [ERROR] ${error}`);
      incrErrorConnectionCount();
    });

    this.incomingSocket.on(kQueueMessage, () => {
      this.incomingLock = true;
      logger.info(`${INCOMING} [${this.connectionId}] [QUEUE] - STARTED`);
    });

    this.incomingSocket.on(kSendMessage, (msg) => {
      this.incomingSocket.send(msg);
      logger.debug(`${INCOMING} [${this.connectionId}] [MESSAGE] - ${msg}`);
    });

    this.incomingSocket.on(kSendPing, () => {
      this.incomingSocket.ping();
    });

    this.incomingSocket.on(kDrainMessage, (msg) => {
      this.outgoingSocket.emit(kSendMessage, msg);
    });

    this.incomingSocket.on(kConnectionOpened, () => {
      if (isNotUndefined(this.upstreamCloseTimer)) {
        clearTimeout(this.upstreamCloseTimer);
        this.upstreamCloseTimer = null;
      }
      this.outgoingSocket.emit(kDequeueMessage);
      logger.debug(`${INCOMING} [${this.connectionId}] [OPEN]`);
      incrNewConnect();
      incrActiveConnectionCount();
    });

    this.incomingSocket.on(kClientClosed, (code, msg) => {
      logger.info(
        `${INCOMING} [${this.connectionId}] [CLOSE] - Socket closed with ${code} and ${msg}`
      );
      this.outgoingSocket.emit(kQueueMessage);
      this.upstreamCloseTimer = setTimeout(
        this.closingOutgoingSocket.bind(this),
        config.closeTimer
      );
      incrClosedConnectionCount();
      decrActiveConnectionCount();
    });

    this.incomingSocket.on(kDequeueMessage, () => {
      this.incomingSocket.drainQueue();
    });

    this.incomingSocket.on(kEnableOutgoingQueue, () => {
      this.outgoingLock = true;
      this.incomingSocket.emit(kSendMessage, PROXY_LOCKED);
    });

    this.incomingSocket.on(kDrainCompleted, () => {
      if (this.incomingLock) {
        this.incomingLock = false;
        logger.info(`${INCOMING} [${this.connectionId}] [QUEUE] - COMPLETED`);
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

    this.outgoingSocket.on(kAddNewContext, (connectionId) => {
      this.emit(kAddNewContext, connectionId);
    });

    this.outgoingSocket.on(kPingReceived, () => {
      this.incomingSocket.emit(kSendPing);
    });

    this.outgoingSocket.on(kMessageReceived, (msg) => {
      if (this.outgoingLock) {
        logger.debug(`${OUTGOING} [${this.connectionId}] [QUEUE] - ${msg}`);
        this.outgoingSocket.addToQueue(msg);
      } else this.incomingSocket.emit(kSendMessage, msg);
    });

    this.outgoingSocket.on(kError, (error) => {
      logger.error(`${OUTGOING} [${this.connectionId}] [ERROR] ${error}`);
      incrErrorConnectionCount();
    });

    this.outgoingSocket.on(kQueueMessage, () => {
      this.outgoingLock = true;
      logger.info(`${OUTGOING} [${this.connectionId}] [QUEUE] - STARTED`);
    });

    this.outgoingSocket.on(kEnableIncomingQueue, () => {
      this.incomingLock = true;
      this.outgoingSocket.emit(kSendMessage, PROXY_LOCKED);
    });

    this.outgoingSocket.on(kSendMessage, (msg) => {
      this.outgoingSocket.send(msg);
      logger.debug(`${OUTGOING} [${this.connectionId}] [MESSAGE] - ${msg}`);
    });

    this.outgoingSocket.on(kDequeueMessage, () => {
      this.outgoingSocket.drainQueue();
    });

    this.outgoingSocket.on(kUpstreamClosed, (code, msg) => {
      this.incomingSocket.close(code, msg);
      this.emit(kCleanup, this.connectionId);
      logger.info(
        `${OUTGOING} [${this.connectionId}] [CLOSE] - Socket closed with ${code} and ${msg}`
      );
    });

    this.outgoingSocket.on(kUpstreamRestart, (code, msg) => {
      this.incomingSocket.emit(kQueueMessage);
      logger.info(
        `${OUTGOING} [${this.connectionId}] [RESTART] ${code} - ${msg}`
      );
    });

    this.outgoingSocket.on(kConnectionOpened, () => {
      this.incomingSocket.emit(kDequeueMessage);
      logger.debug(`${OUTGOING} [${this.connectionId}] [OPEN] `);
      incrNewConnect();
      incrActiveConnectionCount();
    });

    this.outgoingSocket.on(kDrainMessage, (msg) => {
      this.incomingSocket.emit(kSendMessage, msg);
    });

    this.outgoingSocket.on(kDrainCompleted, () => {
      if (this.outgoingLock) {
        this.outgoingLock = false;
        logger.info(`${OUTGOING} [${this.connectionId}] [QUEUE]- COMPLETED`);
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
