/* eslint-disable no-underscore-dangle */
const WebSocket = require('ws');
const logger = require('../utilities/logger')('bridges:local');
const tryParse = require('../utilities/tryParse');

const ANNOUNCE_TOPIC = 'lambda-devtools/announce';
const LAMBDA_TOPIC_PREFIX = 'lambda-devtools/lambda';
const DEVTOOLS_TOPIC_PREFIX = 'lambda-devtools/devtools';

class SimpleWsServer {
  constructor(config, onReady = () => {}) {
    logger.debug({ config }, 'starting local ws broadcast server');
    this._wss = new WebSocket.Server(config);
    this._wss.on('connection', (ws) => {
      logger.debug('new socket connected');
      ws.on('message', (data) => {
        this._wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(data);
          }
        });
      });
    });
    this._wss.on('listening', (ws) => {
      logger.info('simple ws server listening');
      onReady();
    });
  }
}

class SimpleWs {
  constructor({
    localConfig, onMessage, topics, onReady = () => {},
  }) {
    this.emitMessage = onMessage;
    this.topics = topics;
    this._ws = new WebSocket(localConfig.address, localConfig);
    logger.debug({ localConfig }, 'connecting to simple ws server');
    this._ws.on('open', () => {
      logger.debug('connected');
      this._ws.on('message', (...args) => this.onMessage(...args));
      onReady();
    });
  }

  onMessage(data) {
    const { topic, payload } = (tryParse(data.toString()) || {});
    if (!topic || !payload) {
      logger.warn({ data: data.toString() }, 'dropped bad message');
    }
    if (topic === this.topics.inbound) {
      this.emitMessage(payload);
    }
  }

  send(message) {
    if (!this.topics.outbound) {
      logger.warn({ message, topics: this.topics }, 'cannot send message without outbound topic');
      return;
    }
    const topic = this.topics.outbound;
    this.sendToTopic(topic, message);
  }

  sendToTopic(topic, message) {
    const payload = message.toString();
    const data = JSON.stringify({ topic, payload });
    this._ws.send(data);
  }
}


class LocalLambdaBridge {
  constructor(session, onMessage, localConfig) {
    const topics = {
      inbound: `${LAMBDA_TOPIC_PREFIX}/${session.id}`,
      outbound: `${DEVTOOLS_TOPIC_PREFIX}/${session.id}`,
    };
    this._ws = new SimpleWs({
      localConfig,
      onMessage,
      onReady: () => this._onReady(),
      topics,
    });
    this._session = session;
  }

  // public
  send(message) {
    this._ws.send(message);
  }

  // "private"
  _onReady() {
    logger.debug({ session: this._session }, 'announced');
    const topic = ANNOUNCE_TOPIC;
    const payload = JSON.stringify(this._session);
    this._ws.sendToTopic(topic, payload);
  }
}

class LocalDevtoolsBridge {
  constructor(id, onMessage, localConfig) {
    const topics = {
      inbound: `${DEVTOOLS_TOPIC_PREFIX}/${id}`,
      outbound: `${LAMBDA_TOPIC_PREFIX}/${id}`,
    };
    this._ws = new SimpleWs({ localConfig, onMessage, topics });
  }

  send(message) {
    this._ws.send(message);
  }
}

class LocalClientBridge {
  constructor({ start, ...localConfig }) {
    if (start) {
      this._server = new SimpleWsServer(localConfig,);
    }

    const topics = { inbound: ANNOUNCE_TOPIC };
    const onMessage = message => this._onAnnounce(tryParse(message));
    this._ws = new SimpleWs({ localConfig, onMessage, topics });

    this._connections = {};
    this._sessions = {};
    this._localConfig = localConfig;
  }

  connect(id, onMessage) {
    if (this._connections[id]) {
      return this._connections[id];
    }
    const devtools = new LocalDevtoolsBridge(id, onMessage, this._localConfig);
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

module.exports = { LocalLambdaBridge, LocalClientBridge };
