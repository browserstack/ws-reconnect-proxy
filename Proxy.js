'use strict';

const WebSocket = require('ws');
const { config, kCleanup, kAddNewContext } = require('./constants');
const logger = require('./loggerFactory.js');
const Context = require('./Context.js');
const {
  isReconnectHeader,
  extractConnectionId
} = require('./requestMeta.js');

/**
 * Proxy is the entrypoint and instantiates the context among the socket connection.
 * WebSocket server is created & maintaining contexts of connections that are established.
 *
 * Registers the contexts holding all the connections which are created.
 */
class Proxy {

  /**
   * Creates the Proxy.
   */
  constructor() {
    this.server = new WebSocket.Server({ port: config.port });
    this.contexts = new Map();
    this.server.on('connection', this.connectionHandler.bind(this));
  }

  /**
   * Triggers when connection is established on socket.
   *
   * @param {object} socket
   * @param {object} request
   */
   connectionHandler(socket, request) {
    if (isReconnectHeader(request)) {
      const reconnectId = extractConnectionId(request);
      if (this.contexts.has(reconnectId)) {
        const context = this.contexts.get(reconnectId);
        context.addNewConnection(socket, request);
      }
    } else {
      const context = new Context(null);
      context.addNewConnection(socket, request);
      context.on(kCleanup, (connectionId) => {
        this.contexts.delete(connectionId);
        context.removeAllListeners(kCleanup);
      });

      context.on(kAddNewContext, (connectionId) => {
        this.contexts.add(connectionId, context);
        context.removeAllListeners(kAddNewContext);
      })
    }
  }
}

module.exports = Proxy;
