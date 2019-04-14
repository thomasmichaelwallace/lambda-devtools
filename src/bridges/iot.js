const awsIot = require('aws-iot-device-sdk');
const pino = require('pino');
const WebSocket = require('ws');
const {
  level, ANNOUNCE_TOPIC, LAMBDA_TOPIC_PREFIX, DEVTOOLS_TOPIC_PREFIX,
} = require('../../config');

const logger = pino({ name: 'lambda-devtools:bridges:iot', level });

const session = {
  id: process.env.AWS_LAMBDA_LOG_STREAM_NAME.substr(-32) || 'lambda-devtools-local',
  title: `lambda://${process.env.AWS_REGION}/${process.env.AWS_LAMBDA_FUNCTION_NAME}/${process.env.AWS_LAMBDA_FUNCTION_VERSION}`,
  url: `${process.env.LAMBDA_TASK_ROOT}/${(process.env._HANDLER || 'local.handler').split('.')[0]}.js`, // eslint-disable-line no-underscore-dangle, max-len
};

const LAMBDA_TOPIC = `${LAMBDA_TOPIC_PREFIX}/${session.id}`;
const DEVTOOLS_TOPIC = `${DEVTOOLS_TOPIC_PREFIX}/${session.id}`;

function bridge(inspectorUrl) {
  let lambda;
  let devtools;

  const ready = () => {
    devtools.publish(ANNOUNCE_TOPIC, JSON.stringify(session));
  };

  const ws = new WebSocket(inspectorUrl);
  ws.onopen(() => {
    logger.debug('lambda open');
    lambda = ws;
    if (devtools) {
      ready();
    } else {
      logger.debug({ inspectorUrl }, 'waiting for devtools to connect');
    }
  });
  ws.onmessage((data) => {
    if (devtools) {
      logger.debug({ data }, 'lambda -> devtools');
      devtools.publish(DEVTOOLS_TOPIC, data);
    } else {
      logger.warn({ data }, 'no devtools connected: dropped message');
    }
  });
  ws.onerror((error) => {
    logger.error({ error }, 'lambda error');
  });
  ws.onclose(() => {
    logger.debug('lambda closed');
    if (devtools) {
      logger.debug('devtools auto-closed');
      devtools.end(true);
    }
  });

  const config = {
    keyPath: 'TODO: key-path',
    certPath: 'TODO: cert-path',
    caPath: 'TODO: ca-path',
    clientId: `lambda-${session.id}`,
    host: 'TODO: host',
  };
  const iot = awsIot.device(config);
  iot.on('connect', () => {
    logger.debug('devtools connected');
    iot.subscribe(LAMBDA_TOPIC);
    devtools = iot;
    if (lambda) {
      ready();
    } else {
      logger.debug({ inspectorUrl }, 'waiting for lambda to connect');
    }
  });
  iot.on('message', (topic, payload) => {
    if (topic === LAMBDA_TOPIC) {
      if (lambda) {
        logger.debug({ payload }, 'devtools -> lambda');
        lambda.send(payload.toString());
      } else {
        logger.warn({ payload }, 'no lambda connected: dropped message');
      }
    } else {
      logger.error({ topic, payload }, 'unexpected devtools message');
    }
  });
  iot.on('error', (error) => {
    logger.error({ error }, 'devtools error');
  });
}

const [_, __, inspectorUrl] = process.argv; // eslint-disable-line no-unused-vars
bridge(inspectorUrl);
