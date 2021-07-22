'use strict';

const EventEmitter = require('events');
const {
  kConnectionOpened,
  kMessageReceived,
  kClientClosed,
  kDrainMessage,
  kDrainCompleted,
  kUpstreamClosed
} = require('./constants.js');
const logger = require('./loggerFactory.js');
const Queue = require('./queue.js');

/**
  * Incoming connection to the proxy will be treated as an IncomingWebSocket.
  * This will be the object having 1:1 relationship with the
  * OutgoingWebSocket object. Since each client connection will
  * have its own unique upstream.
  *
  * Each Incoming and Outgoing WebSocket is tied with a context. Context is an
  * object which store the state for the session.
  */
class IncomingWebSocket extends EventEmitter {
  constructor(socket, request) {
    super();
    this.socket = socket;
    this.request = request;
    this.queue = new Queue();
    this.teardown = false;
    this.registerListeners();
  }

  /**
   * Registers the socket listeners.
   */
  registerListeners() {
    this.socket.on('open', this.openHandler.bind(this));
    this.socket.on('error', this.errorHandler.bind(this));
    this.socket.on('message', this.messageHandler.bind(this));
    this.socket.on('close', this.closeHandler.bind(this));
  }

  /**
   * Triggers when socket connection is opened.
   */
  openHandler(){
    this.emit(kConnectionOpened);
  }

  /**
   * Triggers when message is received on socket.
   *
   * @param {string} msg
   */
  messageHandler(msg) {
    logger.debug(`Received message on incoming socket: ${msg}`);
    this.emit(kMessageReceived, msg);
  }

  /**
   * Triggers when socket connection is closed.
   *
   * @param {number} code
   * @param {string} msg
   */
  closeHandler(code, msg) {
    if (!this.teardown) {
      logger.debug(`Client is closed sending kClientClosed`);
      this.emit(kClientClosed, code, msg);
    }
    logger.debug(`Recived close code for incoming: ${code} and ${msg}`);
  }

  /**
   * Triggers when error occured on socket.
   */
  errorHandler() {
    logger.error("Error occured in incoming socket!");
  }

  /**
   * Sets the incoming socket.
   *
   * @param {object} socket
   * @param {object} request
   */
   setSocket(socket, request) {
    this.socket = socket;
    this.request = request;
    this.addListener();
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
   * Drains the queue and emits completed event.
   */
  drainQueue() {
    while (!this.queue.isEmpty()) {
      this.emit(kDrainMessage, this.queue.dequeue());
    }
    this.emit(kDrainCompleted);
  }

  /**
   * Closes the socket connection.
   */
  close() {
    logger.debug(`Terminating the client socket`);
    this.teardown = true;
    this.socket.close(1001, '');
    this.socket.terminate();
  }

  /**
   * Sends the message on socket.
   *
   * @param {string} msg
   */
  send(msg) {
    this.socket.send(msg);
  }
}

module.exports = IncomingWebSocket;
