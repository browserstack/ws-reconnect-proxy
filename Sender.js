'use strict';

const logger = require('./loggerFactory.js');
const { config, kUpstreamClosed, kReceivedReply } = require('./constants.js');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const Upstream = require('./upstream.js');
const Queue = require('./queue.js');

class Sender {
  constructor() {
    this.server = new WebSocket.Server({ port: config.port });
    this.handleIncoming();
    this.upstreamWait = new Map();
    this.upstreams = new Map();
    this.msgQueue = new Map();
    logger.info(`Server started on port ${config.port}`);
  }

  createUpstream(socket) {
    this.upstreamWait.set(socket.id, true);
    const resolveFn = () => {
      const list = this.msgQueue.get(socket.id);
      while (!list.isEmpty()) {
        this.forwardUpstream(socket.id, list.dequeue());
      }
      this.upstreamWait.set(socket.id, false);
    };
    const upstream = Upstream.createSocket(config.upstream, socket.id, resolveFn);
    this.addUpstreamEvents(socket, upstream);
    this.upstreams.set(socket.id, upstream);
  }

  addUpstreamEvents(socket, upstream) {
    upstream.on(kReceivedReply, msg => {
      socket.send(msg);
    });

    upstream.on(kUpstreamClosed, () => {
      const resolveFn = () => {
        const list = this.msgQueue.get(socket.id);
        while (!list.isEmpty()) {
          this.forwardUpstream(socket.id, list.dequeue());
        }
        this.upstreamWait.set(socket.id, false);
      };
      this.upstreamWait.set(socket.id, true);
      upstream.startRetries(resolveFn);
    });
  }

  handleIncoming() {
    this.server.on('connection', ws => {
      ws.id = uuidv4();
      logger.info(`Received incoming connection: ${ws.id}`);
      this.createUpstream(ws);
      const list = new Queue();
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
        logger.info(`Received close for ${ws.id} with code: ${code} and msg: ${msg}`);
        if (this.upstreams.has(ws.id)) {
          this.upstreams.get(ws.id).close(code, msg);
        }
      });
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
