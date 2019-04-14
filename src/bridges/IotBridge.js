const awsIot = require('aws-iot-device-sdk');
const pino = require('pino');
const tryParse = require('../utilities/tryParse');
const { level } = require('../../config');


const logger = pino({ name: 'lambda-devtools:bridges:iot', level });

const ANNOUNCE_TOPIC = 'lambda-devtools/announce';
const LAMBDA_TOPIC_PREFIX = 'lambda-devtools/lambda';
const DEVTOOLS_TOPIC_PREFIX = 'lambda-devtools/devtools';

let iot; // use a global aws-iot subscription
let sessions;

function connect(config) {
  if (iot) {
    return;
  }
  iot = awsIot.device(config);
  iot.on('connect', () => { logger.debug('connected'); });
  iot.on('message', ({ topic, payload }) => {
    if (topic === ANNOUNCE_TOPIC) {
      const session = tryParse(payload.toString());
      if (!session) {
        logger.warn({ payload }, 'invalid session announced');
      } else {
        if (sessions === undefined) {
          logger.warn('unexpected session announcement');
          sessions = {};
        }
        logger.info({ session }, 'new session announced');
        sessions[session.id] = session;
      }
    }
  });
}
function whenConnected(fn) {
  if (iot.connected) {
    fn();
  } else {
    iot.on('connect', () => fn());
  }
}

class IotBridge {
  constructor(id, receive, { mode, iot: config }) {
    this.id = id;
    this.receiveFn = receive;

    this.sessions = null;

    if (mode === 'lambda') {
      this.inbound = `${LAMBDA_TOPIC_PREFIX}/${id}`;
      this.outbound = `${DEVTOOLS_TOPIC_PREFIX}/${id}`;
      this.clientId = `lambda-${id}`;
    } else if (mode === 'devtools') {
      this.inbound = `${DEVTOOLS_TOPIC_PREFIX}/${id}`;
      this.outbound = `${LAMBDA_TOPIC_PREFIX}/${id}`;
      const uuid = (Math.random() * 100000000000).toString(36).replace('.', '');
      this.clientId = `devtools-${uuid}`;
    } else {
      throw new TypeError(`Unsupported mode "${mode}"`);
    }

    connect({ ...config, clientId: this.clientId });
    const subscribe = () => {
      iot.subscribe(this.inbound);
      iot.on('message', this.receive);
      logger.debug({ topic: this.subscribedTopic, id }, 'subscribed');
    };
    whenConnected(subscribe);
  }

  announce() {
    const title = `lambda://${process.env.AWS_REGION}/${process.env.AWS_LAMBDA_FUNCTION_NAME}/${process.env.AWS_LAMBDA_FUNCTION_VERSION}`;
    const src = (process.env._HANDLER || '$.handler').split('.')[0]; // eslint-disable-line no-underscore-dangle
    const url = `${process.env.LAMBDA_TASK_ROOT}/${src}.js`;
    const session = { id: this.id, title, url };
    const announce = () => {
      logger.debug({ session: this.session }, 'iot bridge announced');
      iot.publish(ANNOUNCE_TOPIC, JSON.stringify(session));
    };
    whenConnected(announce);
  }

  static sessions() {
    if (!sessions) {
      sessions = {};
      const subscribe = () => {
        iot.subscribe(ANNOUNCE_TOPIC);
        logger.debug({ topic: ANNOUNCE_TOPIC }, 'subscribed');
      };
      whenConnected(subscribe);
    }
    return sessions;
  }

  receive({ topic, payload }) {
    if (topic === this.inbound) {
      this.receiveFn(payload);
    }
  }

  send(data) {
    if (!iot || !iot.connected) {
      logger.warn({ data }, 'iot not connected; message dropped');
      return;
    }
    iot.publish(this.outbound, data);
  }
}

module.exports = IotBridge;
