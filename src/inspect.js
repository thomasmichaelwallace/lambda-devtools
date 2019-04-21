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
 * @param {boolean} [options.restart=true] if true (default) inspector will restart the debugging
 *  session each time inspect is called
 * @param {boolean} [options.patchConsole=true] if true (default) console[debug|info|log|warn|error]
 * @param {integer} [options.port=9229] port (9229 by default) to use for node inspector
 *  will be (re-)patched to report in devtools
 * @param {Object} options.iot aws-iot-device-sdk-js awsIot.device options
 *  see https://github.com/aws/aws-iot-device-sdk-js#device for full description.
 *  Note that clientId will be automatically assigned.
 *  If not provided defaults to using lambda IAM role to connect to env.LAMBDA_DEVTOOLS_HOST
 */
function inspect(options) {
  const {
    enabled = true, patchConsole = true, restart = true, // options
    iot, local, // brdiges
  } = options;
  let inspectorUrl = inspector.url();
  if (!enabled) {
    if (inspectorUrl) {
      logger.warn('closing debugger; inspector socket will remain open due to node bug');
      // inspector.close() causes segfault. ths is fixed in v10.6 (nodejs/node #18761)
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

  let config;
  let inspectorPort = 9239;
  if (local) {
    config = {
      type: 'local',
      ...defaults,
      ...local,
    };
    inspectorPort = defaults.devtoolsPort;
  } else if (iot) {
    config = { type: 'iot', ...iot };
  } else {
    config = { type: 'iot', protocol: 'wss', host: process.env.LAMBDA_DEVTOOLS_HOST };
  }

  if (bridge && bridge.connected && restart) {
    logger.info('killing bridge to prompt debug session restart');
    bridge.kill();
  }

  if (!inspectorUrl) {
    inspector.open(inspectorPort);
    inspectorUrl = inspector.url();
    logger.info({ inspectorUrl }, 'inspector started');
  } else {
    logger.debug({ inspectorUrl }, 're-connecting inspector');
  }
  if (bridge && bridge.connected) {
    logger.info('re-using bridge');
    return;
  }

  logger.info({ options }, 'attaching lambda-devtools bridge');
  const args = [JSON.stringify({ patchConsole, inspectorUrl, ...config })];
  bridge = fork(path.join(__dirname, './bridge'), args);
}

module.exports.inspect = inspect;
