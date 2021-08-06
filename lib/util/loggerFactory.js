'use strict';

const pino = require('pino');
const Logger = pino({}, pino.destination('./logs/proxy.log'));

Logger.level = process.env.NODE_ENV === 'prod' ? 'info' : 'debug';

function getDefaultObjects() {
	return {
		pid: process.pid,
	};
}

module.exports = Logger.child(getDefaultObjects());
