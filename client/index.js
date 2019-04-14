const http = require('http');
const pino = require('pino');
const url = require('url');
const { bridge } = require('./bridges/iot');
const { level } = require('../config');

const logger = pino({ name: 'lambda-devtools:client', level });

const [_, __, host = '127.0.0.1', port = '9229'] = process.argv; // eslint-disable-line no-unused-vars

const sessions = {};
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

server.on('request', (request, response) => {
  logger.debug({ request }, 'server request');
  if (!request.method.toUpperCase() === 'GET') {
    logger.warn({ method: request.method }, 'unsupported method');
    return response.end();
  }
  const { pathname } = url.parse(request.url);
  response.setHeader('Content-Type', 'application/json');
  response.statusCode = 200;
  if (pathname === '/json') {
    const jsonSessions = Object.values(sessions).map(asDevtoolsJson);
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
  logger.debug({ request }, 'server upgrade');
  const id = url.parse(request.url).pathname.replace('/');
  const session = sessions[id];
  if (!session) {
    logger.warn({ id }, 'unknown lambda id');
    return socket.destroy();
  }
  return bridge(id, { request, socket, head });
});

server.listen(port, host);
