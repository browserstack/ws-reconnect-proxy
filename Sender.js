'use strict';

const logger = require('./loggerFactory.js');
const { config, kUpstreamClosed, kReceivedReply } = require('./constants.js');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { URL } = require('url');
const Upstream = require('./upstream.js');
const Queue = require('./queue.js');

class Sender {
  constructor() {
    this.server = new WebSocket.Server({ port: config.port });
    this.server.on('connection', this.handleIncoming.bind(this));
    this.upstreamWait = new Map();
    this.upstreams = new Map();
    this.msgQueue = new Map();
    logger.info(`Server started in sender mode on port ${config.port}`);
  }

  static createTarget(suffixURL) {
    const url = new URL(suffixURL, config.upstream);
    return url.href;
  }

  createUpstream(socket) {
    this.upstreamWait.set(socket.id, true);
    const resolveFn = this.enableUpstream(socket).bind(this);
    const upstream = Upstream.createSocket(socket.id,
      { url: Sender.createTarget(socket.reqURL), headers: socket.reqHeaders },
      resolveFn
    );
    this.addUpstreamEvents(socket, upstream);
    this.upstreams.set(socket.id, upstream);
  }

  enableUpstream(socket) {
    return () => {
      const list = this.msgQueue.get(socket.id);
      while (!list.isEmpty()) {
        this.forwardUpstream(socket.id, list.dequeue());
      }
      logger.debug(`Upstrea wait set to false for ${socket.id}`);
      this.upstreamWait.set(socket.id, false);
    };
  }

  addUpstreamEvents(socket, upstream) {
    upstream.on(kReceivedReply, msg => {
      socket.send(msg);
    });

    upstream.on(kUpstreamClosed, () => {
      this.upstreamWait.set(socket.id, true);
      upstream.startRetries(this.enableUpstream(socket).bind(this));
    });
  }

  handleIncoming(ws, request) {
    ws.id = uuidv4();
    ws.reqURL = request.url;
    ws.reqHeaders = request.headers;
    logger.info(`Received incoming connection: ${ws.id}`);
    this.createUpstream(ws);
    const list = new Queue();
    // This is added because if nothing is written on the socket in some time
    // it will lead to socket end through proxy.
    ws.pingInterval = setInterval(() => ws.ping(), 40000);

    ws.on('pong', () => {
      logger.debug(`Received pong on the socket: ${ws.id}`);
    });

    this.msgQueue.set(ws.id, list);

    ws.on('message', (msg) => {
      logger.debug(`Received ${msg} on ${ws.id}`);
      if (this.upstreamWait.get(ws.id)) {
        list.enqueue(msg);
      } else {
        this.forwardUpstream(ws.id, msg);
      }
    });

    ws.on('close', (code, msg) => {
      if (ws.pingInterval) {
        logger.debug(`Clearing the debug interval for ${ws.id}`);
        clearImmediate(ws.pingInterval);
      }
      logger.info(`Received close for ${ws.id} with code: ${code} and msg: ${msg}`);
      if (this.upstreams.has(ws.id)) {
        this.upstreams.get(ws.id).close(code, msg);
      }
    });
  }

  forwardUpstream(id, msg) {
    if (this.upstreams.has(id)) {
      this.upstreams.get(id).send(msg);
    } else {
      logger.info(`No upstream found for ${id}`);
    }
  }
};

module.exports = Sender;
