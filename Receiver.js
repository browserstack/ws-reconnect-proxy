'use strict';

const logger = require('./loggerFactory.js');
const { config } = require('./constants.js');
const { URL } = require('url');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const Queue = require('./queue.js');

class Receiver {
  constructor() {
    this.server = new WebSocket.Server({ port: config.port });
    this.server.on('connection', this.handleIncoming.bind(this));
    this.resolveFn = () => {};
    this.waiting = new Promise((res) => {
      this.resolveFn = res;
    });
    this.clientOnline = false;
    this.upstreamWait = () => {
      this.waiting = false;
    };
    this.upstreamQueue = new Queue();
    this.upstream = null;
    this.queue = new Queue();
    logger.info(`Server started in Receiver mode on port ${config.port}`);
  }

  static updateURL(suffixURL, host) {
    const upstreamURL = new URL(suffixURL, `ws://${host}`);
    return upstreamURL.href;
  }

  connectToUpstream(url) {
    if (this.upstream === null) {
      this.upstream = new WebSocket(url);
      this.upstream.on('open', this.resolveFn);
      this.upstream.on('message', this.upstreamMessageHandling.bind(this));
      this.upstream.on('error', (err) => {
        logger.info(`Received error on upstream socket in receiver mode: ${err}`);
      });
    }
  }

  upstreamMessageHandling(msg) {
    if (!this.clientOnline) {
      this.queue.enqueue(msg);
    } else {
      this.server.clients.forEach(client => {
        client.send(msg);
      });
    }
  }

  drainQueue() {
    while (!this.queue.isEmpty()) {
      const front = this.queue.dequeue();
      this.server.clients.forEach(client => {
        client.send(front);
      });
    }
  }

  static determineReceiverUpstream(request) {
    const { headerKey, host } = config.receiverUpstream;
    const { url, headers } = request;
    const hostVal = typeof headerKey === 'string' ?
      (headers[headerKey] || host) :
      host;
    return Receiver.updateURL(url, hostVal);
  }

  handleIncoming(socket, request) {
    socket.id = uuidv4();
    logger.info(`Received incoming request for ${socket.id}`);
    this.connectToUpstream(Receiver.determineReceiverUpstream(request));

    if (!this.clientOnline) {
      this.drainQueue();
      this.clientOnline = true;
    }

    socket.on('message', async msg => {
      await this.waiting;
      this.upstream.send(msg);
    });

    socket.on('close', (code, msg) => {
      this.clientOnline = this.server.clients.size !== 0;
      logger.info(`Received close for ${socket.id} with ${code} and ${msg}`);
    });
  }
};

module.exports = Receiver;
