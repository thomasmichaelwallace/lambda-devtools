const awsIot = require('aws-iot-device-sdk');
const WebSocket = require('ws');
const pino = require('pino');
const {
  level, ANNOUNCE_TOPIC, LAMBDA_TOPIC_PREFIX, DEVTOOLS_TOPIC_PREFIX,
} = require('../../config');

const logger = pino({ name: 'lambda-devtools:client:bridges:iot', level });

const sockets = {};

const uuid = 'TODO: devtools id';

let lambda;
const config = {
  keyPath: 'TODO: key-path',
  certPath: 'TODO: cert-path',
  caPath: 'TODO: ca-path',
  clientId: `devtools-${uuid}`,
  host: 'TODO: host',
};
const iot = awsIot.device(config);
iot.on('connect', () => {
  iot.subscribe(ANNOUNCE_TOPIC);
  lambda = iot;
});
iot.on('message', (topic, payload) => {
  if (topic === ANNOUNCE_TOPIC) {
    const session = JSON.parse(payload.toString());
    logger.info({ session }, 'announce');
    // TODO: register session.
  }
  if (topic.startsWith(DEVTOOLS_TOPIC_PREFIX)) {
    const id = topic.replace(`${DEVTOOLS_TOPIC_PREFIX}/`, '');
    const devtools = sockets[id];
    if (devtools) {
      logger.debug({ payload }, `lambda/${id} -> devtools`);
      devtools.send(payload.toString());
    }
  }
});

function bridge(id, { request, socket, head }) {
  logger.debug({ id }, 'upgrading socket to iot bridge');
  const wss = new WebSocket.Server({ noServer: true });
  const lambdaTopic = `${LAMBDA_TOPIC_PREFIX}/${id}`;
  wss.on('connection', (ws) => {
    logger.debug({ id }, 'devtools connected');
    sockets[id] = ws;
    ws.on('message', (data) => {
      logger.debug({ data }, `devtools -> lambda/${id}`);
      if (lambda) {
        lambda.publish(lambdaTopic(id), data);
      } else {
        logger.warn({ data }, 'no lambda connected: dropped message');
      }
    });
  });
  wss.handleUpdate(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
}

module.exports.bridge = bridge;
