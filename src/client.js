const http = require('http');
const url = require('url');
const yargs = require('yargs');
const devtools = require('./adapters/devtools');
const bridges = require('./bridges');
const logger = require('./utilities/logger')('client');

let bridge;
const { argv } = yargs
  .scriptName('lambda-devtools client')
  .usage('$0 [args]')
  .command('$0', 'start iot client', {
    'iot-endpoint': {
      alias: 'e',
      describe: 'AWS IoT broker endpoint',
      demandOption: true,
    },
    'iot-cert': {
      alias: 'cert',
      describe: 'path to AWS IoT broker issued client certificate',
      demandOption: true,
    },
    'iot-key': {
      alias: 'key',
      describe: 'path to AWS IoT broker issued private key',
      demandOption: true,
    },
    'iot-ca': {
      alias: 'ca',
      describe: 'path to AWS IoT broker issued CA certificate',
      demandOption: true,
    },
  }, (args) => {
    const options = {
      host: args['iot-endpoint'],
      certPath: args['iot-cert'],
      caPath: args['iot-ca'],
      keyPath: args['iot-key'],
    };
    bridge = new (bridges('iot').Client)(options);
  })
  .command('local', 'start local client', {
    start: {
      alias: 's',
      default: true,
      describe: 'start local simple websocket server',
    },
    'local-port': {
      alias: 'l',
      default: 8888,
      describe: 'port to run local websocket server',
    },
  }, (args) => {
    const port = args['local-port'];
    const host = '127.0.0.1'
    const options = {
      port,
      host,
      address: `ws:/${host}:${port}`,
      start: args.start,
    };
    bridge = new (bridges('local').Client)(options);
  })
  .options({
    host: {
      alias: 'h',
      default: '127.0.0.1',
      describe: 'devtools server host address',
    },
    port: {
      alias: 'p',
      default: 9229,
      describe: 'devtools server port',
    },
    'patch-console': {
      default: true,
      describe: 'enable support for lambda-devtools patched console messages',
      type: 'boolean',
    },
  })
  .help();

const { host, port, patchConsole } = argv;


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
  return devtools.start(id, { request, socket, head }, bridge, { patchConsole });
});

server.listen(port, host);
logger.info(`client listening on ${host}:${port}`);
