const inspector = require('inspector');
const path = require('path');
const { fork } = require('child_process');
const { patch } = require('./patches/console');
const logger = require('./utilities/logger')('inspect');
const { local: defaults } = require('./config');

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
  let inspectorUrl = inspector.url();
  if (!enabled) {
    if (inspectorUrl) {
      logger.info('disabling existing inspector session');
      inspector.close();
    }
    if (bridge) {
      logger.info('disabling existing bridge');
      bridge.kill();
      bridge = undefined;
    }
    return;
  }
  if (patchConsole) {
    patch();
  }
  if (inspector.url()) {
    logger.info({ inspectorUrl }, 're-using inspector');
  }
  if (bridge) {
    logger.info('re-using bridge');
    return;
  }
  let config;
  let inspectorPort = 9239;
  if (iot) {
    config = { type: 'iot', ...iot };
  } else if (local) {
    config = {
      type: 'local',
      ...defaults,
      ...local,
    };
    inspectorPort = defaults.devtoolsPort;
  } else {
    throw new TypeError('Either IoT or Local type options must be provided');
  }

  if (!inspectorUrl) {
    inspector.open(inspectorPort);
    inspectorUrl = inspector.url();
    logger.debug({ inspectorUrl }, 'inspector started');
  } else {
    logger.debug({ inspectorUrl }, 're-connecting inspector');
  }

  if (bridge && bridge.exitCode === null) {
    logger.debug('re-using bridge');
    return;
  }

  logger.info({ options }, 'attaching lambda-devtools bridge');
  const args = [JSON.stringify({ patchConsole, inspectorUrl, ...config })];
  bridge = fork(path.join(__dirname, './bridge'), args);
}

module.exports.inspect = inspect;
