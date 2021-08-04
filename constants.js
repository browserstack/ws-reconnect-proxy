'use strict';

const process = require('process');
const env = process.env.NODE_ENV || 'dev'; 
const config = require('./config.json')[env];

const logger = require('./loggerFactory');

const kSender = Symbol('kSender');
const kReceiver = Symbol('kReceiver');
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
	'upgrade'
];


const CONNECTION_ID_HEADER = 'x-connection-id';
const RECONNECT_ID_HEADER = 'x-reconnect-id';

const OUTGOING = '[OUTGOING]';
const INCOMING = '[INCOMING]';

class ConfigParser {
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
		if (typeof port !== 'number') {
			logger.info('Not a valid port number, using default (8081)');
			portVal = 8081;
		} else {
			portVal = port;
		}
		this.port = portVal;
		return this;
	}

	setReceiverUpstream() {
		const { receiverUpstream } = config;
		if (this.isSender) {
			logger.info('Not using receiver upstream in sender mode');
			this.receiverUpstream = null;
		} else if (typeof receiverUpstream !== 'object') {
			logger.error('Invalid type for receiverUpstream using default object {}');
			this.receiverUpstream = {};
		} else {
			this.receiverUpstream = receiverUpstream;
		}
		return this;
	}

	setCloseTimer() {
		const { closeTimer } = config;
		let newCloseTimer = 5000;
		if (typeof closeTimer !== 'undefined' && typeof closeTimer === 'number') {
			newCloseTimer = closeTimer;
		} else {
			logger.info(`No close timer value sent using default (${newCloseTimer})`);
		}
		this.closeTimer = newCloseTimer;
		return this;
	}

	setAlertConfig() {
		const { alertPath, alertReceivers, alertHost, alertPort } = config;
		this.alertPath = alertPath || '';
		this.alertHost = alertHost || '';
		this.alertPort = alertPort || '';
		this.alertReceivers = alertReceivers || [];
		return this;
	}
}

const configParser = (new ConfigParser())
	.setupHooks()
	.setupRetries()
	.setupRetryDelay()
	.setPort()
	.setWorkers()
	.setUpstream()
	.setCloseTimer()
	.setAlertConfig();


module.exports = {
	config: configParser,
	RECONNECT,
	SERVICE_RESTART,
	DISALLOWED_HEADERS,
	CONNECTION_ID_HEADER,
	RECONNECT_ID_HEADER,
	INCOMING,
	OUTGOING,
	kSender,
	kUpstreamClosed,
	kReceivedReply,
	kReceiver,
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
	kUpstreamRestart
};
