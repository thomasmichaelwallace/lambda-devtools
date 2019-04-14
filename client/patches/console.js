const pino = require('pino');
const { level } = require('../../config');

const logger = pino({ name: 'lambda-devtools:client:patches:console', level });

function tryParse(string) {
  try {
    const object = JSON.parse(string);
    return object;
  } catch (_) {
    return null;
  }
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
  if (a !== null || b !== '__lambda_devtools') {
    logger.debug({ message }, 'skipped genuine dir message');
    return data;
  }
  const logLevel = message.params.args.shift().value;
  message.params.type = logLevel;
  message.params.stackTrace.callFrames.shift(); // remove patch frame
  logger.debug({ message }, 'transpile patched console.dir');
  return JSON.stringify(message);
}

module.exports.transpile = transpile;
