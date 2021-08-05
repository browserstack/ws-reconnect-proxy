'use strict';

const WebSocket = require('ws');
const { config, kCleanup, kAddNewContext } = require('./constants');
const logger = require('./loggerFactory');
const Context = require('./Context');
const {
	isReconnectHeader,
	extractConnectionId,
	extractReconnectId,
} = require('./util');

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
	 * @param {WebSocket} socket
	 * @param {object} request
	 */
	connectionHandler(socket, request) {
		if (isReconnectHeader(request.headers)) {
			const reconnectId = extractReconnectId(request.headers);
			if (this.contexts.has(reconnectId)) {
				const context = this.contexts.get(reconnectId);
				context.addNewConnection(socket, request);
			} else {
				logger.info(`[${reconnectId}] - Unable to find reconnectId`);
			}
		} else {
			const connId = extractConnectionId(request.headers);
			const context = new Context(connId);
			context.addNewConnection(socket, request);
			context.on(kCleanup, (connectionId) => {
				this.contexts.delete(connectionId);
				context.removeAllListeners(kCleanup);
			});

			context.on(kAddNewContext, (connectionId) => {
				this.contexts.set(connectionId, context);
				context.removeAllListeners(kAddNewContext);
			});

			if (connId !== null && typeof connId === 'string') {
				this.contexts.set(connId, context);
			}
		}
	}
}

module.exports = Proxy;
