const pino = require('pino');
const tryParse = require('../utilities/tryParse');
const { level } = require('../../config');

const logger = pino({ name: 'lambda-devtools:patches:console', level });

const PATCHED_ARG_A = null;
const PATCHED_ARG_B = '__lambda_devtools';

function patch() {
  /* eslint-disable no-console */
  if (console.__lambda_devtools_patched === true) { // eslint-disable-line no-underscore-dangle
    return; // prevent nesting patches
  }

  ['debug', 'info', 'log', 'warn', 'error'].forEach((key) => {
    const type = key === 'warn' ? 'warning' : key;
    console[key] = (...args) => {
      console.dir(PATCHED_ARG_A, PATCHED_ARG_B, type, ...args);
    };
  });

  console.__lambda_devtools_patched = true; // eslint-disable-line no-underscore-dangle
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
    logger.debug({ message }, 'skipped standard message');
    return data;
  }
  const a = message.params.args.shift().value;
  const b = message.params.args.shift().value;
  if (a !== PATCHED_ARG_A || b !== PATCHED_ARG_B) {
    logger.debug({ message }, 'skipped genuine dir message');
    return data;
  }
  const logLevel = message.params.args.shift().value;
  message.params.type = logLevel;
  message.params.stackTrace.callFrames.shift(); // remove patch frame
  logger.debug({ message }, 'transpile patched console.dir');
  return JSON.stringify(message);
}

module.exports = { patch, transpile };
