'use strict';

const WebSocket = require('ws');
const { config } = require('./constants');
const logger = require('./loggerFactory.js');
const Context = require('./Context.js');
const {
  isReconnectHeader,
  extractConnectionId
} = require('./requestMeta.js');

class Proxy {
  constructor() {
    this.server = new WebSocket.Server({ port: config.port });
    this.contexts = new Map();
    this.server.on('connection', this.incomingConnectionHandler.bind(this));
  }

  incomingConnectionHandler(socket, request) {
    if (isReconnectHeader(request)) {
      const reconnectId = extractConnectionId(request);
      if (this.contexts.has(reconnectId)) {
        const context = this.contexts.get(reconnectId);
        context.addNewIncomingConnection(socket, request);
      }
    } else {
    }
  }
}

module.exports = Proxy;
