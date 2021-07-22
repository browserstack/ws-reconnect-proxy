const { config } = require('./constants.js');

function createTarget(suffixURL) {
  const url = new URL(suffixURL, config.upstream);
  return url.href;
}

module.exports = {
  createTarget
};
