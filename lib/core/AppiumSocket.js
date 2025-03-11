// AppiumSocket.js
'use strict';

const EventEmitter = require('events');
const logger = require('../util/loggerFactory');
const appiumSessionDriver = require('../util/AppiumSession');
const { kSendMessage } = require('../config/constants');

/**zzxx
 * AppiumSocket handles specific events for Appium communication.
 */
class AppiumSocket extends EventEmitter {
  constructor() {
    super();
    this.registerListeners();
  }

  /**
   * Registers listeners for the AppiumSocket.
   */
  registerListeners() {
    this.on(kSendMessage, this.handleSendMessage.bind(this));
  }

  /**
   * Handles the kSendMessage event.
   *
   * @param {string} msg - The message to log.
   */
  async handleSendMessage(msg) {
    logger.info(`AppiumSocket received message: ${typeof msg} ${msg}`);

    const { method, params } = JSON.parse(msg);

    if (method === 'initialize') {
      await appiumSessionDriver();
    }
  }
}

module.exports = AppiumSocket;