const logger = require('./loggerFactory');

/**
 * Sends alert information.
 */
class AlertManager {
  constructor() {
    this.sendAlert = this.sendAlert.bind(this);
  }

  /**
   * Logs the alert information that needs to be sent.
   * Here, you can configure your alert endpoint.
   *
   * @param {String} title
   * @param {String} subject
   * @param {String} message
   */
  sendAlert(title, subject, message) {
    logger.info(
      `Alert with title: ${title} subject: ${subject} message: ${message}`
    );
  }
}

module.exports = AlertManager;
