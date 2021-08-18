'use strict';
const logger = require('./loggerFactory');
const packageJson = require('../../package.json');
const AlertManager = require('../util/AlertManager');
const alertManager = new AlertManager();
class ProcessHandler {
  onError(err) {
    const stackTrace = err.stack ? err.stack.toString() : err.toString();
    logger.error(`Global Exception: ${err.toString()} ${stackTrace}`);

    if (process.env.NODE_ENV === 'prod') {
      const title = packageJson.name;
      const subject = `Global Exception: ${err.toString()}`;
      const message = `Global Exception: ${err.toString()} ${stackTrace}`;
      alertManager.sendAlert(title, subject, message);
    }
  }
}

module.exports = ProcessHandler;
