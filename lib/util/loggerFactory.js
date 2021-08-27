'use strict';

const os = require('os');
const pino = require('pino');
const packageJson = require('../../package.json');
const { isString } = require('./typeSanity');
const Logger = pino(
  {
    level: process.env.NODE_ENV === 'prod' ? 'info' : 'debug',
    base: null,
    timestamp: () => `, "time": "${new Date(Date.now()).toISOString()}"`,
    messageKey: 'message',
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  },
  isString(process.env.LOG_PATH) && pino.destination(process.env.LOG_PATH)
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
