'use strict';

const WebSocket = require('ws');
const { config, kCleanup, kAddNewContext, HTTPLOG } = require('../config/constants');
const logger = require('../util/loggerFactory');
const Context = require('./Context');
const {
  isReconnectHeader,
  extractConnectionId,
  extractReconnectId,
} = require('../util/util');
const { isString } = require('../util/typeSanity');
const http = require('http');
const { URL } = require('url');
const { setMetrics } = require('../util/metrics');
const AlertManager = require('../util/AlertManager');
const Instrumentation = require('../util/Instrumentation');
const ErrorHandler = require('../util/ErrorHandler');

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
  constructor(
    alertManager = new AlertManager(),
    instrumentation = new Instrumentation()
  ) {
    this.alertManager = alertManager;
    this.instrumentation = instrumentation;
    this.httpServer = http.createServer(this.requestHandler.bind(this));
    this.httpServer.listen(config.port, config.hostname);
    this.upstreamURL = new URL(config.upstream);
    this.server = new WebSocket.Server({ server: this.httpServer });
    this.contexts = new Map();
    this.server.on('connection', this.connectionHandler.bind(this));
    if (config.enableInstrumentation) {
      this.captureInstrumentation();
    }
    process.on(
      'uncaughtException',
      new ErrorHandler(this.alertManager).onError
    );
  }

  /**
   * Pipes the request and response.
   *
   * @param {Object} request
   * @param {Object} response
   */
  requestHandler(request, response) {
    request.headers.host = this.upstreamURL.host;
    const options = {
      hostname: this.upstreamURL.hostname,
      port: this.upstreamURL.port,
      path: request.url,
      method: request.method,
      headers: request.headers,
    };
    logger.info(`${HTTPLOG} Received http request ${options}`);
    if(request.url.indexOf('/status') > -1){
      response.writeHead(200, {'content-type': 'application/json; charset=utf-8', 'accept': 'application/json', 'WWW-Authenticate': 'Basic realm="WS Reconnect Proxy"'});
      response.end(JSON.stringify({"status" : "Running"}));
      return;
    }
    const proxyReq = http.request(options, (proxyResponse) => {
      response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
      proxyResponse.pipe(response, {
        end: true,
      });
    });
    proxyReq.on('error', (error)=>{
      logger.error(`${request.url} received error ${error}`);
    });
    proxyReq.on('timeout', ()=>{
      logger.info(`${request.url} timed out`);
    });
    proxyReq.on('drain', ()=>{
      logger.info(`${request.url} drained out`);
    });
    request.pipe(proxyReq, {
      end: true,
    });
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
   * Captures the instrumentation and pushes the metrics.
   */
  captureInstrumentation() {
    setInterval(() => {
      this.instrumentation.pushMetrics();
      setMetrics();
    }, config.instrumentationTimer);
  }
}

module.exports = Proxy;
