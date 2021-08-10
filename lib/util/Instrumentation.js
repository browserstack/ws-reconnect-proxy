const logger = require('./loggerFactory');
const { getMetrics } = require('./metrics');

class Instrumentation {
	constructor() {
		this.pushMetrics = this.pushMetrics.bind(this);
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
