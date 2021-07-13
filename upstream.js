'use strict';

const WebSocket = require('ws');
const logger = require('./loggerFactory');
const EventEmitter = require('events');
const { kUpstreamClosed, config, kReceivedReply } = require('./constants');
const util = require('util');

const noop = () => {};
const sleep = util.promisify(setTimeout);

const DISALLOWED_HEADERS = [
  'host',
  'connection',
  'sec-websocket-key',
  'sec-websocket-version',
  'upgrade'
];

class Upstream extends EventEmitter {
  constructor(id, { url, headers }, resolveFn = noop) {
    super();
    this.url = url;
    this.retrying = true;
    DISALLOWED_HEADERS.forEach(h => delete headers[h]);
    this.headers = headers;
    this.replayInfo = null;
    this.resolveFn = resolveFn;
    this.termminated = false;
    this.clientId = id;
    logger.debug(`Creating upstream with ${url}`);
    this.connect(url, resolveFn);
  }

  generateHeaders() {
    if (this.replayInfo !== null) {
      this.headers['X-Replay'] = true;
    }
    return this.headers;
  }

  connect(url, resolveFn) {
    this.socket = new WebSocket(url, {
      headers: this.generateHeaders()
    });
    this.socket.on('open', () => {
      logger.info(`Connected to upstream for ${this.clientId}`);
      this.retrying = false;
      if (this.replayInfo !== null) {
        // Send the replayInfo before the continuation
        // of message proxoy
        this.socket.send(this.replayInfo);
      }
      resolveFn();
    });
    this.socket.on('close', this.closedUpstream.bind(this));
    this.socket.on('error', this.errorUpstream.bind(this));
    this.socket.on('message', this.replyToClient.bind(this));
  }

  async closedUpstream(code, msg) {
    logger.info(`Upstream closed for ${this.clientId} with code: ${code}`);
    if (!this.terminated) {
      // For now assume it is hard close only
      if (code === 1006 && !this.retrying) {
        this.emit(kUpstreamClosed);
      } else {
        await sleep(config.retryDelayVal);
        this.connect(this.url, this.resolveFn);
      }
    }
  }

  replyToClient(msg) {
    if (msg.substring(0, 9) === 'REPLAY_UP') {
      this.replayInfo = msg;
      this.socket.terminate();
      return;
    }
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

  static createSocket(id, socketOpts, resolve) {
    return new Upstream(id, socketOpts, resolve);
  }
};

module.exports = Upstream;
