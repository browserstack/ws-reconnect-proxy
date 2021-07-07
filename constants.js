'use strict';

const config = require('./config');
const logger = require('./loggerFactory');

const kSender = Symbol('kSender');
const kReceiver = Symbol('kReceiver');
const kUpstreamClosed = Symbol('kUpstreamClosed');
const kReceivedReply = Symbol('kReceivedReply');

class ConfigParser {
  constructor() {
    const { upstream, executionMode: mode } = config;
    if (mode !== 0 && mode !== 1) {
      throw new Error(`Invalid mode type present ${mode}`);
    }
    if (mode === 0 && typeof upstream !== 'string') {
      throw new Error('Invalid upstream present');
    }
    this.mode = mode;
  }

  setupRetries() {
    const { retryLimit } = config;
    let retryVal;
    if (retryLimit === 'undefined') {
      logger.info('No retry limit specified using default (10)');
      retryVal = 10;
    } else if (typeof retryLimit !== 'number') {
      logger.error(`Invalid value for retrylimit: ${retryLimit} using default (10)`);
      retryVal = 10;
    } else {
      retryVal = retryLimit;
    }
    this.retryVal = retryVal;
    return this;
  }

  setupRetryDelay() {
    const { retryDelay } = config;
    let retryDelayVal;
    if (typeof retryDelay === 'undefined') {
      logger.info('No retry delay value sent using default (10)');
      retryDelayVal = 10;
    } else if (typeof retryDelay !== 'number') {
      logger.error(`Inavlid value for retryDelay: ${retryDelay} using default (10)`);
      retryDelayVal = 10;
    } else {
      retryDelayVal = retryDelay;
    }
    this.retryDelayVal = retryDelayVal;
    return this;
  }

  decideMode() {
    if (this.mode === 0) {
      this.state = kSender;
      this.isSender = true;
      this.isReceiver = false;
    }

    if (this.mode === 1) {
      this.state = kReceiver;
      this.isSender = false;
      this.isReceiver = true;
    }
    return this;
  }

  setupHooks() {
    const { hooksInfo = {} } = config;
    if (Object.keys(hooksInfo).length === 0) {
      logger.info('Alert hook not setup');
    } else if (typeof hooksInfo.url !== 'string') {
      logger.error('Hooks URL is not string, using nothing');
    }
    return this;
  }

  setWorkers() {
    const { workers } = config;
    let workerVal = 2;
    if (typeof workers !== 'number') {
      logger.error('Unvalid workers defined using default (2)');
    } else {
      workerVal = workers;
    }
    this.workerVal = workerVal;
    return this;
  }

  setSenderUpstream() {
    this.upstream = config.upstream;
    return this;
  }

  setPort() {
    const { port } = config;
    let portVal;
    if (typeof port !== 'number') {
      logger.info('Not a valid port number, using default (8081)');
      portVal = 8081;
    } else {
      portVal = port;
    }
    this.port = portVal;
    return this;
  }
}

const configParser = (new ConfigParser())
  .decideMode()
  .setupHooks()
  .setupRetries()
  .setupRetryDelay()
  .setPort()
  .setWorkers()
  .setSenderUpstream();

module.exports = {
  config: configParser,
  kSender,
  kUpstreamClosed,
  kReceivedReply,
  kReceiver
}
