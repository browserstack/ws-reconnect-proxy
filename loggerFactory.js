'use strict';

const os = require('os');
const Logger = require('pino')();

Logger.level = 'debug';

function getDefaultObjects() {
  return {
    host: os.hostname(),
    pid: process.pid
  };
}

module.exports = Logger.child(getDefaultObjects());
