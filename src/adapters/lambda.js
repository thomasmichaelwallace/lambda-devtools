const WebSocket = require('ws');
const pino = require('pino');
const { level } = require('../../config');

const logger = pino({ name: 'lambda-devtools:adapters:lambda', level });

const id = (process.env.AWS_LAMBDA_LOG_STREAM_NAME || 'lambda-devtools-local').substr(-32);

function start(inspectorUrl, Bridge, options = {}) {
  logger.debug({ inspectorUrl }, 'starting lambda adapter');
  const lambda = new WebSocket(inspectorUrl);
  let bridge;

  lambda.on('open', () => {
    logger.debug('lambda open');
    const receive = (data) => {
      logger.debug({ data }, 'devtools -> lambda');
      lambda.send(data.toString());
    };
    bridge = new Bridge(id, receive, { mode: 'lambda', ...options });
    bridge.announce();
  });

  lambda.on('message', (data) => {
    logger.debug({ data }, 'lambda -> devtools');
    bridge.send(data);
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
