const WebSocket = require('ws');
const pino = require('pino');
const { level } = require('../../config');

const logger = pino({ name: 'lambda-devtools:bridges:iot', level });

const id = process.env.AWS_LAMBDA_LOG_STREAM_NAME.substr(-32) || 'lambda-devtools-local';

function start(inspectorUrl, Bridge, options = {}) {
  logger.debug({ inspectorUrl }, 'starting lambda adapter');
  const lambda = new WebSocket(inspectorUrl);
  let bridge;

  lambda.onopen(() => {
    logger.debug('lambda open');
    const receive = (data) => {
      logger.debug({ data }, 'devtools -> lambda');
      lambda.send(data.toString());
    };
    bridge = new Bridge(id, receive, { mode: 'lambda', ...options });
  });

  lambda.onmessage((data) => {
    logger.debug({ data }, 'lambda -> devtools');
    bridge.send(data);
  });

  lambda.onerror((error) => {
    logger.error({ error }, 'lambda error');
  });

  lambda.onclose(() => {
    logger.debug('lambda closed');
    // TODO: anything?
  });
}

module.exports.start = start;
