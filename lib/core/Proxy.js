'use strict';

const WebSocket = require('ws');
const { config, kCleanup, kAddNewContext } = require('../config/constants');
const logger = require('../util/loggerFactory');
const Context = require('./Context');
const {
	isReconnectHeader,
	extractConnectionId,
	extractReconnectId,
} = require('../util/util');
const { isString } = require('../util/typeSanity');
const Instrumentation = require('../util/Instrumentation');

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
		if (config.enableInstrumentation) {
			this.captureInstrumentation();
		}
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

			if (isString(connId)) {
				this.contexts.set(connId, context);
			}
		}
	}

	/**
	 * Captures the instrumentation and pushes metrics.
	 */
	captureInstrumentation() {
		const instrumentation = new Instrumentation();
		setInterval(() => {
			instrumentation.pushMetrics();
		}, config.instrumentationTimer);
	}
}

module.exports = Proxy;
