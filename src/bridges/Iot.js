const awsIot = require('aws-iot-device-sdk');
const tryParse = require('../utilities/tryParse');
const logger = require('../utilities/logger')('bridges:iot');

const ANNOUNCE_TOPIC = 'lambda-devtools/announce';
const LAMBDA_TOPIC_PREFIX = 'lambda-devtools/lambda';
const DEVTOOLS_TOPIC_PREFIX = 'lambda-devtools/devtools';

class Iot {
  constructor({
    iot, iotConfig, onMessage, topics, onReady = () => {},
  }) {
    this.emitMessage = onMessage;
    this.topics = topics;
    if (iot) {
      this.iot = iot;
      this.onConnect();
      onReady();
    } else {
      logger.debug({ iotConfig }, 'connecting to aws iot');
      this.iot = awsIot.device(iotConfig);
      this.iot.on('connect', () => {
        logger.debug({ clientId: iotConfig.clientId }, 'connected');
        this.onConnect();
        onReady();
      });
    }
  }

  onConnect() {
    if (!this.topics.inbound) {
      return;
    }
    this.iot.subscribe(this.topics.inbound);
    this.iot.on('message', (...args) => this.onMessage(...args));
    logger.debug({ topic: this.inbound }, 'subscribed');
  }

  onMessage(topic, payload) {
    if (topic === this.topics.inbound) {
      const message = payload.toString();
      this.emitMessage(message);
    }
  }

  send(message) {
    if (!this.topics.outbound) {
      logger.warn({ message, topics: this.topics }, 'cannot send message without outbound topic');
      return;
    }
    this.iot.publish(this.topics.outbound, message);
  }
}

class IotLambdaBridge extends Iot {
  constructor(session, onMessage, iotConfig) {
    const topics = {
      inbound: `${LAMBDA_TOPIC_PREFIX}/${session.id}`,
      outbound: `${DEVTOOLS_TOPIC_PREFIX}/${session.id}`,
    };
    const clientId = `lambda-${session.id}`;
    super({
      iotConfig: { clientId, ...iotConfig },
      onMessage,
      onReady: () => this.onReady(),
      topics,
    });
    this.session = session;
  }

  onReady() {
    logger.debug({ session: this.session }, 'announced');
    this.iot.publish(ANNOUNCE_TOPIC, JSON.stringify(this.session));
  }
}

class IotDevtoolsBridge extends Iot {
  constructor(id, onMessage, iot) {
    const topics = {
      inbound: `${DEVTOOLS_TOPIC_PREFIX}/${id}`,
      outbound: `${LAMBDA_TOPIC_PREFIX}/${id}`,
    };
    super({ onMessage, topics, iot });
  }
}

class IotClientBridge extends Iot {
  constructor(iotConfig) {
    const uid = Math.random().toString(36).replace('.', '');
    const clientId = `lambda-devtools-${uid}`;
    const topics = { inbound: ANNOUNCE_TOPIC };
    const onMessage = message => this.onAnnounce(tryParse(message));
    super({ iotConfig: { clientId, ...iotConfig }, onMessage, topics });

    this.connections = {};
    this.sessions = {};
  }

  connect(id, onMessage) {
    if (this.connections[id]) {
      return this.connections[id];
    }
    const devtools = new IotDevtoolsBridge(id, onMessage, this.iot);
    this.connections[id] = devtools;
    return this.connections[id];
  }

  onAnnounce(session) {
    if (!session || !session.id) {
      logger.warn({ session }, 'invalid session announced');
      return;
    }
    logger.info({ session }, 'new session announced');
    this.sessions[session.id] = session;
  }
}

module.exports = { IotLambdaBridge, IotClientBridge };
