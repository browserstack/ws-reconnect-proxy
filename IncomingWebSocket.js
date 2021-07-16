'use strict';

const EventEmitter = require('events');
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
    this.socket = socket;
    this.request = request;
    this.queue = new Queue();
  }

  addListener() {
    this.socket.on('message', this.messageHandler.bind(this));
    this.socket.on('close', this.closeHandler.bind(this));
  }

  messageHandler(msg) {
    this.emit('kMessageReceived', msg);
  }

  closeHandler(code, msg) {
    this.emit('kClientClosed', code, msg);
  }

  addToQueue(msg) {
    this.queue.enqueue(msg);
  }
}

module.exports = IncomingWebSocket;
