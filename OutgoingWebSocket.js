'use strict';

const EventEmitter = require('events');
const ws = require('ws');
const Queue = require('./queue.js');

/**
  * Outgoing WebSocket connection is the connection object
  * to the upstream server. Each upstream will have a unique
  * client connection (IncomingWebSocket edge). This is a general
  * abstraction over WebSocket so that custom events can be emitted
  * on the object itself and the implementation can be handled in the
  * class member function itself.
  */
class OutgoingWebSocket extends EventEmitter {
  constructor() {
    this.shouldRetry = false;
    this.socket = null;
    this.headers = {};
    this.queue = new Queue();
  }

  addSocket() {
    this.socket = new WebSocket(url, {
      headers: this.headers
    });
    this.socket.on('open', this.connectionOpen.bind(this));
    this.socket.on('message', this.connectionMessageHandling.bind(this));
    this.socket.on('close', this.connectionClosed.bind(this));
  }

  connectionOpen() {
    this.emit('kConnectionOpened');
  }

  connectionMessageHandling(msg) {
    this.emit('kMessageReceived', msg);
  }

  connectionClosed(code, msg) {
    if (msg === 'RESTART_SERVER')
      this.emit('kUpstreamRestart', code, msg);
    else
      this.emit('kUpstreamClosed', code, msg);
  }

  addToQueue(msg) {
    this.queue.enqueue(msg);
  }
};

module.exports = OutgoingWebSocket;
