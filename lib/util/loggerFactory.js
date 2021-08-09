'use strict';

const os = require('os');
const pino = require('pino');
const packageJson = require('../../package.json');
const Logger = pino({
	level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug',
	base: null,
	timestamp: null,
	messageKey: 'message',
	formatters : {
		level (label) {
			return { level: label };
		}
	}
}, pino.destination('./logs/proxy.log'));

function getDefaultObjects() {
	return {
		meta: {
			application: packageJson.name,
			component: packageJson.name,
			pid: process.pid,
			hostname: os.hostname(),
			time: new Date(Date.now()).toISOString(),
		}
	};
}

module.exports = Logger.child(getDefaultObjects());
