'use strict';
const logger = require('./loggerFactory');
const packageJson = require('../../package.json');

/**
 * Used for processing application level error handling.
 */
class ErrorHandler {
  /**
   * Creates the ErrorHandler with the AlertManager configured.
   *
   * @param {AlertManager} alertManager
   */
  constructor(alertManager) {
    this.alertManager = alertManager;
    this.onError = this.onError.bind(this);
  }

  /**
   * Handle errors and notify.
   *
   * @param {Object} err
   */
  onError(err) {
    const stackTrace = err.stack ? err.stack.toString() : err.toString();
    logger.error(`Global Exception: ${err.toString()} ${stackTrace}`);

    if (process.env.NODE_ENV === 'prod') {
      const title = packageJson.name;
      const subject = `Global Exception: ${err.toString()}`;
      const message = `Global Exception: ${err.toString()} ${stackTrace}`;
      this.alertManager.sendAlert(title, subject, message);
    }
  }
}

module.exports = ErrorHandler;
