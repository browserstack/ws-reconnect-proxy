const { config, CONNECTION_ID_HEADER, RECONNECT_ID_HEADER } = require("./constants");

function createTarget(suffixURL) {
  const url = new URL(suffixURL, config.upstream);
  return url.href;
}

function extractReconnectId(headers) {
  const { [RECONNECT_ID_HEADER]: reconnectId } = headers;
  return reconnectId;
}

function extractConnectionId(headers) {
  const { [CONNECTION_ID_HEADER]: connectionId } = headers;
  return connectionId;
}

function isReconnectHeader(headers) {
  return typeof extractReconnectId(headers) !== 'undefined';
}

module.exports = {
  createTarget,
  extractReconnectId,
  extractConnectionId,
  isReconnectHeader
};
