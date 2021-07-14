'use strict';

const EventEmitter = require('events');

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
  constructor() {
  }
}

module.exports = IncomingWebSocket;
