'use strict';

const Logger = require('pino')();

Logger.level = 'debug';

function getDefaultObjects() {
  return {
    pid: process.pid
  };
}

module.exports = Logger.child(getDefaultObjects());
