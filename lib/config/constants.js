'use strict';

const env = process.env.NODE_ENV || 'dev';
const config = require('./config.json')[env];
const logger = require('../util/loggerFactory');
const {
	isUndefined,
	isNotNumber,
	isNotString,
	isNumber,
	isNotBoolean,
} = require('../util/typeSanity');

const kUpstreamClosed = Symbol('kUpstreamClosed');
const kReceivedReply = Symbol('kReceivedReply');
const kStartConnection = Symbol('kStartConnection');
const kMessageReceived = Symbol('kMessageReceived');
const kError = Symbol('kError');
const kSendMessage = Symbol('kSendMessage');
const kQueueMessage = Symbol('kQueueMessage');
const kDrainMessage = Symbol('kDrainMessage');
const kConnectionOpened = Symbol('kConnectionOpened');
const kDequeueMessage = Symbol('kDequeueMessage');
const kClientClosed = Symbol('kClientClosed');
const kCleanup = Symbol('kCleanup');
const kDrainCompleted = Symbol('kDrainCompleted');
const kReleaseTap = Symbol('kReleaseTap');
const kAddNewContext = Symbol('kAddNewContext');
const kUpstreamRestart = Symbol('kUpstreamRestart');

const RECONNECT = 'RECONNECT';
const SERVICE_RESTART = 'Service Restart';

const DISALLOWED_HEADERS = [
	'host',
	'connection',
	'sec-websocket-key',
	'sec-websocket-version',
	'upgrade',
];

const CONNECTION_ID_HEADER = 'x-connection-id';
const RECONNECT_ID_HEADER = 'x-reconnect-id';

const OUTGOING = '[OUTGOING]';
const INCOMING = '[INCOMING]';

class ConfigParser {
	setRetries() {
		const { retryLimit } = config;
		let retryVal;
		if (isUndefined(retryLimit)) {
			logger.info('No retry limit specified using default (10)');
			retryVal = 10;
		} else if (typeof retryLimit !== 'number') {
			logger.error(
				`Invalid value for retrylimit: ${retryLimit} using default (10)`
			);
			retryVal = 10;
		} else {
			retryVal = retryLimit;
		}
		this.retryVal = retryVal;
		return this;
	}

	setRetryDelay() {
		const { retryDelay } = config;
		let retryDelayVal;
		if (isUndefined(retryDelay)) {
			logger.info('No retry delay value sent using default (10)');
			retryDelayVal = 10;
		} else if (isNotNumber(retryDelay)) {
			logger.error(
				`Inavlid value for retryDelay: ${retryDelay} using default (10)`
			);
			retryDelayVal = 10;
		} else {
			retryDelayVal = retryDelay;
		}
		this.retryDelayVal = retryDelayVal;
		return this;
	}

	setHooks() {
		const { hooksInfo = {} } = config;
		if (Object.keys(hooksInfo).length === 0) {
			logger.info('Alert hook not setup');
		} else if (isNotString(hooksInfo.url)) {
			logger.error('Hooks URL is not string, using nothing');
		}
		return this;
	}

	setWorkers() {
		const { workers } = config;
		let workerVal = 2;
		if (isNotNumber(workers)) {
			logger.error('Invalid workers defined using default (2)');
		} else {
			workerVal = workers;
		}
		this.workerVal = workerVal;
		return this;
	}

	setUpstream() {
		this.upstream = config.upstream;
		return this;
	}

	setPort() {
		const { port } = config;
		let portVal;
		if (isNotNumber(port)) {
			logger.info('Not a valid port number, using default (8081)');
			portVal = 8081;
		} else {
			portVal = port;
		}
		this.port = portVal;
		return this;
	}

	setCloseTimer() {
		const { closeTimer } = config;
		let newCloseTimer = 5000;
		if (isNotNumber(closeTimer)) {
			logger.info(`No close timer value sent using default (${newCloseTimer})`);
		} else {
			newCloseTimer = closeTimer;
		}
		this.closeTimer = newCloseTimer;
		return this;
	}

	setWorkerKillTimer() {
		const { workerKillTimer } = config;
		let defaultTimer = 60 * 10 * 1000;
		if (isNotNumber(workerKillTimer)) {
			logger.info(
				`No worker kill timer configured using default (${defaultTimer})`
			);
		} else {
			defaultTimer = workerKillTimer;
		}
		this.workerKillTimer = defaultTimer;
		return this;
	}

	setInstrumentation() {
		const { enableInstrumentation } = config;
		let newEnableInstrumentation = true;
		if (isNotBoolean(enableInstrumentation)) {
			logger.info(
				`No instrumentation configured using default (${newEnableInstrumentation})`
			);
		} else {
			newEnableInstrumentation = enableInstrumentation;
		}
		this.enableInstrumentation = newEnableInstrumentation;
		return this;
	}

	setInstrumentationTimer() {
		const { instrumentationTimer } = config;
		let newInstrumentationTimer = 60000;
		if (isNumber(instrumentationTimer)) {
			logger.info(
				`No instrumentation timer configured using default (${newInstrumentationTimer})`
			);
		} else {
			newInstrumentationTimer = instrumentationTimer;
		}
		this.instrumentationTimer = newInstrumentationTimer;
		return this;
	}

	setRootConfig() {
		this.rootConfig = config;
		return this;
	}
}

const configParser = new ConfigParser()
	.setHooks()
	.setRetries()
	.setRetryDelay()
	.setPort()
	.setWorkers()
	.setUpstream()
	.setCloseTimer()
	.setWorkerKillTimer()
	.setInstrumentation()
	.setRootConfig()
	.setInstrumentationTimer();

module.exports = {
	config: configParser,
	RECONNECT,
	SERVICE_RESTART,
	DISALLOWED_HEADERS,
	CONNECTION_ID_HEADER,
	RECONNECT_ID_HEADER,
	INCOMING,
	OUTGOING,
	kUpstreamClosed,
	kReceivedReply,
	kStartConnection,
	kMessageReceived,
	kError,
	kSendMessage,
	kQueueMessage,
	kDrainMessage,
	kConnectionOpened,
	kDequeueMessage,
	kClientClosed,
	kCleanup,
	kDrainCompleted,
	kReleaseTap,
	kAddNewContext,
	kUpstreamRestart,
};
