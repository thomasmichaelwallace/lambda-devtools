const http = require('http');
const url = require('url');
const { argv } = require('yargs');
const devtools = require('./adapters/devtools');
const Bridge = require('./bridges/IotBridge');
const logger = require('./utilities/logger')('client');

const host = argv.host || '127.0.0.1';
const port = argv.port || '9229';
const options = {
  iot: {
    host: argv['iot-endpoint'],
    certPath: argv['iot-cert'],
    caPath: argv['iot-ca'],
    keyPath: argv['iot-key'],
  },
  patchConsole: !argv['unpatch-console'],
};

function asDevtoolsJson({ id, title, url: file }) {
  return {
    description: 'remove node.js lambda instance',
    devtoolsFrontendUrl: `chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=${host}:${port}/${id}`,
    faviconUrl: 'https://nodejs.org/static/favicon.ico',
    id,
    title,
    type: 'node',
    url: `file://${file}`,
    webSocketDebuggerUrl: `ws://${host}:${port}/${id}`,
  };
}

const server = http.createServer();
const bridge = new Bridge(null, () => {}, { mode: 'client', ...options }); // eslint-disable-line no-unused-vars

server.on('request', (request, response) => {
  // logger.debug({ request }, 'server request');
  if (request.method.toUpperCase() !== 'GET') {
    logger.warn({ method: request.method }, 'unsupported method');
    return response.end();
  }
  const { pathname } = url.parse(request.url);
  // logger.info({ pathname, sessions: Bridge.sessions() }, 'request');
  response.setHeader('Content-Type', 'application/json');
  response.statusCode = 200;
  if (pathname === '/json') {
    const jsonSessions = Object.values(Bridge.sessions()).map(asDevtoolsJson);
    return response.end(JSON.stringify(jsonSessions));
  }
  if (pathname === '/json/version') {
    const jsonVersion = { Browser: 'node.js/v8.10.0', 'Protocol-Version': '1.1' };
    return response.end(JSON.stringify(jsonVersion));
  }
  logger.warn({ pathname }, 'unsupported endpoint');
  response.statusCode = 400;
  return response.end();
});

server.on('upgrade', (request, socket, head) => {
  // logger.debug({ request }, 'server upgrade');
  const id = url.parse(request.url).pathname.replace('/', '');
  logger.debug({ id }, 'upgrade');
  const session = Bridge.sessions()[id];
  if (!session) {
    logger.warn({ id }, 'unknown lambda id');
    return socket.destroy();
  }
  return devtools.start(id, { request, socket, head }, Bridge, options);
});

server.listen(port, host);
logger.info(`client listening on ${host}:${port}`);
