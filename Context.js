'use strict';

const EventEmitter = require('events');
const IncomingWebSocket = require('./IncomingWebSocket.js');
const OutgoingWebSocket = require('./OutgoingWebSocket.js');
const logger = require('./loggerFactory.js');
const { createTarget } = require('./util');
const {
  kSender,
  kUpstreamClosed,
  kReceivedReply,
  kReceiver,
  kStartConnection,
  kMessageReceived,
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
  kUpstreamRestart
} = require('./constants');

/**
 * Context holds the information for the incoming and outgoing sockets.
 *
 * Instantiates the incoming and outgoing sockets and registers the listeners.
 * Acts as a bridge between incoming and outgoing sockets.
 */
class Context extends EventEmitter {

  /**
   * Creates the context.
   *
   * @param {string} connectionId
   */
  constructor(connectionId) {
    super();
    this.connectionId = connectionId;
    this.incomingSocket = null;
    this.outgoingSocket = null;
    this.reconnectData = null;
    this.incomingLock = true;
    this.outgoingLock = false;
  }

  /**
   * Adds a new incoming and outgoing connection.
   *
   * @param {object} socket
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
      this.outgoingSocket.drainQueue();
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
        logger.debug(`Adding to Incoming Socket Queue : ${msg}`);
        this.incomingSocket.addToQueue(msg);
      }
      else
        this.outgoingSocket.emit(kSendMessage, msg);
    });

    this.incomingSocket.on(kQueueMessage, () => {
      this.incomingLock = true;
    });

    this.incomingSocket.on(kSendMessage, msg => {
      this.incomingSocket.send(msg);
    });

    this.incomingSocket.on(kDrainMessage, msg => {
      logger.debug(`Incoming Socket Drain : ${msg}`);
      this.outgoingSocket.emit(kSendMessage, msg);
    });

    this.incomingSocket.on(kConnectionOpened, () => {
      if (this.upstreamCloseTimer != null) {
        clearTimeout(this.upstreamCloseTimer);
        this.upstreamCloseTimer = null;
      }
      this.outgoingSocket.emit(kDequeueMessage);
    });

    this.incomingSocket.on(kClientClosed, (code, msg) => {
      this.outgoingSocket.emit(kQueueMessage);
      this.upstreamCloseTimer = setTimeout(this.closingOutgoingSocket.bind(this), 5000);
    });

    this.incomingSocket.on(kDequeueMessage, () => {
      this.incomingSocket.drainQueue();
    });

    this.incomingSocket.on(kDrainCompleted, () => {
      if (this.incomingLock) {
        this.incomingLock = false;
      }
    });
  }

  /**
   * Closes outgoing socket and emits clean up event.
   */
  closingOutgoingSocket() {
    this.outgoingSocket.close();
    this.emit(kCleanup);
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
    })

    this.outgoingSocket.on(kMessageReceived, msg => {
      if (this.outgoingLock) {
        logger.info(`Adding to Outgoing Socket Queue : ${msg}`);
        this.outgoingSocket.addToQueue(msg);
      }
      else
        this.incomingSocket.emit(kSendMessage, msg);
    });

    this.outgoingSocket.on(kQueueMessage, () => {
      this.outgoingLock = true;
    });

    this.outgoingSocket.on(kSendMessage, msg => {
      this.outgoingSocket.send(msg);
    });

    this.outgoingSocket.on(kDequeueMessage, () => {
      this.outgoingSocket.drainQueue();
    });

    this.outgoingSocket.on(kUpstreamClosed, (code, msg) => {
      this.incomingSocket.close();
      this.emit(kCleanup);
    });

    this.outgoingSocket.on(kUpstreamRestart, (code, msg) => {
      this.incomingSocket.emit(kQueueMessage);
    });

    this.outgoingSocket.on(kConnectionOpened, () => {
      this.incomingSocket.emit(kDequeueMessage);
    });

    this.outgoingSocket.on(kDrainMessage, msg => {
      logger.info(`Outgoing Socket Drain : ${msg}`);
      this.incomingSocket.emit(kSendMessage, msg);
    });

    this.outgoingSocket.on(kDrainCompleted, () => {
      if (this.outgoingLock) {
        this.outgoingLock = false;
      }
    });
  }

  /**
   * Sets the reconnect data.
   *
   * @param {object} data
   */
  setReconnectData(data) {
    this.reconnectData = data;
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
