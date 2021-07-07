'use strict';

const logger = require('./loggerFactory.js');
const { config } = require('./constants.js');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const Queue = require('./queue.js');

class Receiver {
  constructor() {
    this.server = new WebSocket.Server({ port: config.port });
    this.server.on('connection', this.handleIncoming.bind(this));
    this.upstream = new WebSocket(config.upstream);
    this.waiting = true;
    this.clientOnline = false;
    this.upstreamWait = () => {
      this.waiting = false;
    };
    this.queue = new Queue();
    this.upstream.on('open', this.upstreamWait);
    this.upstream.on('message', msg => {
      if (!this.clientOnline) {
        this.queue.enqueue(msg);
      } else {
        this.server.clients.forEach(client => {
          client.send(msg);
        });
      }
    });
    this.upstream.on('error', (err) => {
      logger.info(`Received error on upstream socket in receiver mode: ${err}`);
    });
    logger.info(`Server started on port ${config.port}`);
  }

  drainQueue() {
    while (!this.queue.isEmpty()) {
      const front = this.queue.dequeue();
      this.server.clients.forEach(client => {
        client.send(front);
      });
    }
  }

  handleIncoming(socket) {
    socket.id = uuidv4();
    logger.info(`Received incoming request for ${socket.id}`);
    if (!this.clientOnline) {
      this.drainQueue();
      this.clientOnline = true;
    }
    socket.on('message', msg => {
      if (this.waiting) {
        this.queue.enqueue(msg);
      } else {
        this.upstream.send(msg);
      }
    });

    socket.on('close', (code, msg) => {
      this.clientOnline = this.server.clients.size !== 0;
      logger.info(`Received close for ${socket.id} with ${code} and ${msg}`);
    });
  }
};

module.exports = Receiver;
