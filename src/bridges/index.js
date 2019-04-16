/* eslint-disable global-require */

function getBridge(type) {
  if (type === 'iot') {
    const { IotLambdaBridge: Lambda, IotClientBridge: Client } = require('./Iot');
    return { Client, Lambda };
  }
  if (type === 'local') {
    const { LocalLambdaBridge: Lambda, LocalClientBridge: Client } = require('./Local');
    return { Client, Lambda };
  }
  throw new TypeError(`Unsupported bridge type "${type}"`);
}

module.exports = getBridge;
