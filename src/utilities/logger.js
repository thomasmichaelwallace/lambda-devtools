const pino = require('pino');

const level = (process.env.LAMBDA_DEVTOOLS_DEBUG || 'silent');

function newLogger(name) {
  return pino({ name: `lambda-devtools:${name}`, level });
}

module.exports = newLogger;
