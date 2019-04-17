const WebSocket = require('ws');
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
  return { id, title, url };
}

function start(inspectorUrl, Bridge, options = {}) {
  const session = buildSession();
  logger.debug({ inspectorUrl }, 'starting lambda adapter');
  const lambda = new WebSocket(inspectorUrl);
  let bridge;

  lambda.on('open', () => {
    logger.debug('lambda open');
    const onMessage = (message) => {
      logger.debug({ message }, 'devtools -> lambda');
      if (lambda.readyState === WebSocket.OPEN) {
        lambda.send(message);
      } else {
        logger.warn({ message }, 'dropped message sent before lambda open');
      }
    };
    bridge = new Bridge(session, onMessage, options);
  });

  lambda.on('message', (data) => {
    const message = data.toString();
    logger.debug({ message }, 'lambda -> devtools');
    bridge.send(message);
  });

  lambda.on('error', (error) => {
    logger.error({ error }, 'lambda error');
  });

  lambda.on('close', () => {
    logger.debug('lambda closed');
    // TODO: anything?
  });
}

module.exports.start = start;
