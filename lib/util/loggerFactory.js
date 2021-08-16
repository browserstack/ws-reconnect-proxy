'use strict';

const os = require('os');
const pino = require('pino');
const packageJson = require('../../package.json');
const Logger = pino(
  {
    level: process.env.NODE_ENV === 'prod' ? 'debug' : 'debug',
    base: null,
    timestamp: () => `, "time": "${new Date(Date.now()).toISOString()}"`,
    messageKey: 'message',
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  pino.destination('./logs/proxy.log')
);

function getDefaultObjects() {
  return {
    meta: {
      application: packageJson.name,
      component: packageJson.name,
      pid: process.pid,
      hostname: os.hostname(),
    },
  };
}

module.exports = Logger.child(getDefaultObjects());
