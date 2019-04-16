const http = require('http');
const url = require('url');
const yargs = require('yargs');
const devtools = require('./adapters/devtools');
const { IotClientBridge } = require('./bridges/Iot');
const logger = require('./utilities/logger')('client');

const { argv } = yargs;

const { host, port } = argv;
const options = {
  iot: {
    host: argv['iot-endpoint'],
    certPath: argv['iot-cert'],
    caPath: argv['iot-ca'],
    keyPath: argv['iot-key'],
  },
  patchConsole: argv.patchConsole,
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
const bridge = new IotClientBridge(options.iot);

server.on('request', (request, response) => {
  const method = request.method.toUpperCase();
  const { pathname } = url.parse(request.url);
  logger.debug({ method, pathname }, 'request');
  if (method !== 'GET') {
    logger.warn({ method }, 'unsupported method');
    return response.end();
  }

  response.setHeader('Content-Type', 'application/json');
  response.statusCode = 200;
  if (pathname === '/json' || pathname === '/json/list') {
    const jsonSessions = Object.values(bridge.sessions).map(asDevtoolsJson);
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
  const session = bridge.sessions[id];
  if (!session) {
    logger.warn({ id }, 'unknown lambda id');
    return socket.destroy();
  }
  return devtools.start(id, { request, socket, head }, bridge, options);
});

server.listen(port, host);
logger.info(`client listening on ${host}:${port}`);
