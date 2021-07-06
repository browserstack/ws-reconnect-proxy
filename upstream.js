'use strict';

const WebSocket = require('ws');
const logger = require('./loggerFactory');
const EventEmitter = require('events');
const { kUpstreamClosed, kReceivedReply } = require('./constants');

const noop = () => {};

class Upstream extends EventEmitter {
  constructor(url, id, resolveFn = noop) {
    super();
    this.url = url;
    this.retrying = true;
    this.resolveFn = resolveFn;
    this.termminated = false;
    this.clientId = id;
    this.connect(url, resolveFn);
  }

  connect(url, resolveFn) {
    this.socket = new WebSocket(url);
    this.socket.on('open', () => {
      logger.info(`Connected to upstream for ${this.clientId}`);
      this.retrying = false;
      resolveFn();
    });
    this.socket.on('close', this.closedUpstream.bind(this));
    this.socket.on('error', this.errorUpstream.bind(this));
    this.socket.on('message', this.replyToClient.bind(this));
  }

  closedUpstream(code, msg) {
    logger.info(`Upstream closed for ${this.clientId} with code: ${code}`);
    // For now assume it is hard close only
    if (code === 1006 && !this.retrying && !this.terminated)
      this.emit(kUpstreamClosed);
    else
      this.connect(this.url, this.resolveFn);
  }

  replyToClient(msg) {
    this.emit(kReceivedReply, msg);
  }

  close(code, msg) {
    // TODO: check why the code is not a valid number
    // this.socket.close(code, msg);
    this.terminated = true;
    this.socket.terminate();
  }

  errorUpstream(err) {
    logger.info(`Received error for ${this.clientId} with ${err}`);
  }

  startRetries(resolveFn) {
    this.resolveFn = resolveFn;
    this.retrying = true;
    this.connect(this.url, this.resolveFn);
  }

  send(msg) {
    this.socket.send(msg);
  }

  static createSocket(url, id, resolve) {
    return new Upstream(url, id, resolve);
  }
};

module.exports = Upstream;
