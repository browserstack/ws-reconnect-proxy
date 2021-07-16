'use strict';

function extractConnectionId(request) {
  const { headers: { ['x-reconnect-id']: reconnectId } = {} } = request;
  return reconnectId;
}

function isReconnectHeader(request) {
  return typeof extractConnectionId(request) === 'undefined';
}

module.exports = {
  isReconnectHeader,
  extractConnectionId
};
