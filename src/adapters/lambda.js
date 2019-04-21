const WebSocket = require('ws');
const { inspect } = require('util');
const logger = require('../utilities/logger')('adapters:lambda');

function buildSession() {
  const id = process.env.AWS_LAMBDA_LOG_STREAM_NAME
    ? process.env.AWS_LAMBDA_LOG_STREAM_NAME.substr(-32)
    : 'lambda-devtools-local';
  const region = process.env.AWS_REGION || 'local';
  const name = process.env.AWS_LAMBDA_FUNCTION_NAME || 'function-name';
  const version = process.env.AWS_LAMBDA_FUNCTION_VERSION || '[$latest]';
  const title = `lambda://${region}/${name}/${version}`;
  const src = (process.env._HANDLER || process.argv[1] || '$').split('.')[0]; // eslint-disable-line no-underscore-dangle
  const url = process.env.LAMBDA_TASK_ROOT
    ? `${process.env.LAMBDA_TASK_ROOT}/${src}`
    : src;
  const timestamp = Date.now();
  return {
    id, title, url, timestamp,
  };
}

function start(inspectorUrl, Bridge, options = {}) {
  const session = buildSession();
  logger.debug({ inspectorUrl }, 'starting lambda adapter');
  const lambda = new WebSocket(inspectorUrl);
  let bridge;

  lambda.on('open', () => {
    logger.info('lambda open');
    const onMessage = (message) => {
      if (lambda.readyState < WebSocket.CLOSING) {
        logger.info({ message }, 'devtools -> lambda');
        lambda.send(message);
      } else {
        logger.warn({ message }, 'dropped message sent before lambda open');
      }
    };
    bridge = new Bridge(session, onMessage, options);
  });

  lambda.on('message', (data) => {
    const message = data.toString();
    logger.info({ message }, 'lambda -> devtools');
    bridge.send(message);
  });

  lambda.on('error', (error) => {
    logger.error({ error: inspect(error, true) }, 'lambda error');
  });

  lambda.on('close', () => {
    logger.warn('lambda closed');
    // TODO: anything?
  });
}

module.exports.start = start;
