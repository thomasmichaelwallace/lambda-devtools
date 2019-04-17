const tryParse = require('../utilities/tryParse');
const logger = require('../utilities/logger')('patches:console');

const PATCHED_ARG_A = null;
const PATCHED_ARG_B = '__lambda_devtools';

function patch() {
  /* eslint-disable no-console */
  ['debug', 'info', 'log', 'warn', 'error'].forEach((key) => {
    const type = key === 'warn' ? 'warning' : key;
    if (console[key].name === 'bound consoleCall') {
      logger.info({ key }, 'left un-patched console');
      return;
    }
    if (console[key].__lambda_devtools_patched === true) { // eslint-disable-line no-underscore-dangle, max-len
      logger.debug({ key }, 'skipping patched console');
      return;
    }
    logger.info({ key }, 'patched console');
    const { [key]: forward } = console;
    console[key] = (...args) => {
      console.dir(PATCHED_ARG_A, PATCHED_ARG_B, type, ...args);
      forward(...args);
    };
    console[key].__lambda_devtools_patched = true; // eslint-disable-line no-underscore-dangle
  });
  /* eslint-enable */
}

function transpile(data) {
  const message = tryParse(data);
  if (!message) {
    return data;
  }
  if (
    message.method !== 'Runtime.consoleAPICalled'
    || message.params.type !== 'dir'
    || !Array.isArray(message.params.args)
    || message.params.args.length < 4
  ) {
    logger.debug({ data }, 'skipped standard message');
    return data;
  }
  const a = message.params.args.shift().value;
  const b = message.params.args.shift().value;
  if (a !== PATCHED_ARG_A || b !== PATCHED_ARG_B) {
    logger.debug({ data }, 'skipped genuine dir message');
    return data;
  }
  const logLevel = message.params.args.shift().value;
  message.params.type = logLevel;
  message.params.stackTrace.callFrames.shift(); // remove patch frame
  const translated = JSON.stringify(message);
  logger.debug({ translated }, 'translated patched console.dir');
  return translated;
}

module.exports = { patch, transpile };
