const inspector = require('inspector');
const path = require('path');
const { fork } = require('child_process');
const { patch } = require('./patches/console');
const logger = require('./utilities/logger')('inspect');

let inspectorUrl;
let bridge;

/**
 * Inspector for remote DevTools
 * @param {Object} options lambda-devtools configuration
 * @param {boolean} [options.enabled=true] if true (default) inspector will be enabled and attached
 * @param {boolean} [options.patchConsole=true] if true (default) console[debug|info|log|warn|error]
 * @param {integer} [options.port=9229] port (9229 by default) to use for node inspector
 *  will be (re-)patched to report in devtools
 * @param {Object} options.iot aws-iot-device-sdk-js awsIot.device options
 *  see https://github.com/aws/aws-iot-device-sdk-js#device for full description.
 *  Note that clientId will be automatically assigned.
 * @param {string} options.iot.host AWS IoT endpoint to use for broker
 * @param {string} options.iot.certPath path to AWS IoT issued client certificate
 * @param {string} options.iot.keyPath path to AWS IoT issued private key
 * @param {string} options.iot.caPath path to AWS IoT issued CA certificate file
 */
function inspect(options) {
  const {
    enabled = true, patchConsole = true, iot, local,
  } = options;
  if (!enabled) {
    if (inspectorUrl) {
      logger.info('disabling existing debug session');
      inspector.close();
      bridge.kill();
    }
    return;
  }
  if (inspectorUrl || inspector.url()) {
    logger.info('closing previous invocation debugger');
    inspector.close();
  }
  if (bridge) {
    logger.info('killing previous invocation bridge');
    bridge.kill();
  }
  if (patchConsole) {
    patch();
  }
  let config;
  if (iot) {
    config = { type: 'iot', ...iot };
  } else if (local) {
    const port = local.port || 8888;
    const host = local.host || '127.0.0.1';
    config = {
      type: 'local',
      port,
      host,
      address: `ws://${host}:${port}`,
      start: true,
    };
  } else {
    throw new TypeError('Either IoT or Local type options must be provided');
  }
  inspectorUrl = (inspector.open(options.port) || inspector.url());
  logger.info({ options, url: inspectorUrl }, 'attaching lambda-devtools');
  const args = [JSON.stringify({ patchConsole, inspectorUrl, ...config })];
  bridge = fork(path.join(__dirname, './bridge'), args);
}

module.exports.inspect = inspect;
