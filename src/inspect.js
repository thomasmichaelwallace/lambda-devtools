const inspector = require('inspector');
const path = require('path');
const { fork } = require('child_process');
const { patch } = require('./patches/console');
const logger = require('./utilities/logger')('inspect');

let inspectorUrl;
let bridge;

function inspect(options) {
  const { enabled = true, patchConsole = true, iot } = options;
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
  inspectorUrl = (inspector.open(options.port) || inspector.url());
  logger.info({ options, url: inspectorUrl }, 'attaching lambda-devtools');
  const args = [JSON.stringify({ patchConsole, iot, inspectorUrl })];
  bridge = fork(path.join(__dirname, './bridge'), args);
}

module.exports.inspect = inspect;
