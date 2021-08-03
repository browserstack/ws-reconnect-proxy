'use strict';

const process = require('process');
const pino = require('pino');
const Logger = pino({}, pino.destination('./tmp/proxy.log'));

Logger.level = 'debug';

function getDefaultObjects() {
	return {
		pid: process.pid
	};
}

module.exports = Logger.child(getDefaultObjects());
