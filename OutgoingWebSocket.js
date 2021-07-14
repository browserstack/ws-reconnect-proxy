'use strict';

const EventEmitter = require('events');

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
  }
}

module.exports = OutgoingWebSocket;
