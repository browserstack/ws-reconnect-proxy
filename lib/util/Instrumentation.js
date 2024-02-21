const logger = require('./loggerFactory');
const { getMetrics } = require('./metrics');
const { isProductionEnv } = require('../config/constants');
const { DWH } = require('browserstack-dwh');

class Instrumentation {
  constructor() {
    this.pushMetrics = this.pushMetrics.bind(this);
  }

  async pingZombie(dataJsonObject) {
    const environment = isProductionEnv ? 'production' : 'staging';
    try {
      const payloadLength = await DWH.send('udp', 'pager', dataJsonObject, environment);
      logger.info(`[PAGER] Payload length:${payloadLength}`);
    } catch (err) {
      logger.info(`[PAGER] Exception ${err.toString()} while sending data: ${JSON.stringify(dataJsonObject)}`);
    }
  }

  /**
   * Logs the metrics information.
   * Here you can configure endpoint to push metrics
   */
  pushMetrics() {
    logger.info(`[METRICS] ${JSON.stringify(getMetrics())}`);
  }
}

module.exports = Instrumentation;
