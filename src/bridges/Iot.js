/* eslint-disable no-underscore-dangle */
const awsIot = require('aws-iot-device-sdk');
const tryParse = require('../utilities/tryParse');
const logger = require('../utilities/logger')('bridges:iot');

const ANNOUNCE_TOPIC = 'lambda-devtools/announce';
const LAMBDA_TOPIC_PREFIX = 'lambda-devtools/lambda';
const DEVTOOLS_TOPIC_PREFIX = 'lambda-devtools/devtools';

let iot;

class Iot {
  constructor({
    iotConfig, onMessage, topics, onReady = () => {},
  }) {
    this.emitMessage = onMessage;
    this.topics = topics;
    if (iot) {
      this.onConnect();
      onReady();
    } else {
      logger.debug({ iotConfig }, 'connecting to aws iot');
      iot = awsIot.device(iotConfig);
      iot.on('connect', () => {
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
    iot.subscribe(this.topics.inbound);
    iot.on('message', (...args) => this.onMessage(...args));
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
    iot.publish(this.topics.outbound, message);
  }
}

class IotLambdaBridge {
  constructor(session, onMessage, iotConfig) {
    const topics = {
      inbound: `${LAMBDA_TOPIC_PREFIX}/${session.id}`,
      outbound: `${DEVTOOLS_TOPIC_PREFIX}/${session.id}`,
    };
    const clientId = `lambda-${session.id}`;
    this._iot = new Iot({
      iotConfig: { clientId, ...iotConfig },
      onMessage,
      onReady: () => this._onReady(),
      topics,
    });
    this._session = session;
  }

  // public
  send(message) {
    this._iot.send(message);
  }

  // "private"
  _onReady() {
    logger.debug({ session: this._session }, 'announced');
    iot.publish(ANNOUNCE_TOPIC, JSON.stringify(this._session));
  }
}

class IotDevtoolsBridge {
  constructor(id, onMessage) {
    const topics = {
      inbound: `${DEVTOOLS_TOPIC_PREFIX}/${id}`,
      outbound: `${LAMBDA_TOPIC_PREFIX}/${id}`,
    };
    this._iot = new Iot({ onMessage, topics });
  }

  send(message) {
    this._iot.send(message);
  }
}

class IotClientBridge {
  constructor(iotConfig) {
    const uid = Math.random().toString(36).replace('.', '');
    const clientId = `lambda-devtools-${uid}`;
    const topics = { inbound: ANNOUNCE_TOPIC };
    const onMessage = message => this._onAnnounce(tryParse(message));
    this._iot = new Iot({ iotConfig: { clientId, ...iotConfig }, onMessage, topics });

    this._connections = {};
    this._sessions = {};
  }

  // public
  connect(id, onMessage) {
    if (this._connections[id]) {
      return this._connections[id];
    }
    const devtools = new IotDevtoolsBridge(id, onMessage);
    this._connections[id] = devtools;
    return this._connections[id];
  }

  get sessions() {
    return this._sessions;
  }

  // "private"
  _onAnnounce(session) {
    if (!session || !session.id) {
      logger.warn({ session }, 'invalid session announced');
      return;
    }
    logger.info({ session }, 'new session announced');
    this._sessions[session.id] = session;
  }
}

module.exports = { IotLambdaBridge, IotClientBridge };
