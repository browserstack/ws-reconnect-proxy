'use strict';

const EventEmitter = require('events');
const {
  kConnectionOpened,
  kMessageReceived,
  kError,
  kClientClosed,
  kEnableOutgoingQueue,
  kDrainMessage,
  kDrainCompleted,
  PROXY_RESTART,
} = require('../config/constants');
const Queue = require('./Queue');

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
    this.socket.on('message', this.messageHandler.bind(this));
    this.socket.on('close', this.closeHandler.bind(this));
    this.socket.on('error', this.errorHandler.bind(this));
  }

  /**
   * Triggers when socket connection is opened.
   */
  openHandler() {
    this.emit(kConnectionOpened);
  }

  /**
   * Triggers when message is received on socket.
   *
   * @param {string} msg
   */
  messageHandler(msg) {
    if (msg === PROXY_RESTART) {
      this.emit(kEnableOutgoingQueue);
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
    if (!this.teardown) {
      this.emit(kClientClosed, code, msg);
    }
  }

  /**
   * Triggers when error occured on socket.
   */
  errorHandler(error) {
    this.emit(kError, error);
  }

  /**
   * Sets the incoming socket.
   *
   * @param {WebSocket} socket
   * @param {object} request
   */
  setSocket(socket, request) {
    this.socket = socket;
    this.request = request;
    this.registerListeners();
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
    this.teardown = true;
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

  /**
   * Relays ping from upstream.
   */
  ping() {
    this.socket.ping();
  }
}

module.exports = IncomingWebSocket;
