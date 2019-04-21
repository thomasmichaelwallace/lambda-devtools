const http = require('http');
const url = require('url');
const yargs = require('yargs');
const devtools = require('./adapters/devtools');
const bridges = require('./bridges');
const logger = require('./utilities/logger')('client');
const {
  local, client, patches, devtoolsJson, devtoolsVersion,
} = require('./config');

let bridge;
const { argv } = yargs
  .scriptName('lambda-devtools client')
  .usage('$0 [args]')
  .command('$0', 'start iot client', {
    endpoint: {
      alias: 'e',
      describe: 'AWS IoT broker endpoint',
      demandOption: true,
    },
  }, (args) => {
    const options = {
      host: args.endpoint,
      protocol: 'wss',
    };
    bridge = new (bridges('iot').Client)(options);
  })
  .command('local', 'start local client', {
    start: {
      alias: 's',
      default: local.start,
      describe: 'start local simple websocket server',
    },
    'local-port': {
      alias: 'l',
      default: local.port,
      describe: 'port to run local websocket server',
    },
  }, (args) => {
    const options = {
      port: args['local-port'],
      host: local.host,
      start: args.start,
    };
    bridge = new (bridges('local').Client)(options);
  })
  .options({
    host: {
      alias: 'h',
      default: client.host,
      describe: 'devtools server host address',
    },
    port: {
      alias: 'p',
      default: client.port,
      describe: 'devtools server port',
    },
    'patch-console': {
      default: patches.console,
      describe: 'enable support for lambda-devtools patched console messages',
      type: 'boolean',
    },
    latest: {
      default: true,
      describe: 'only list the latest session to support simple clients like vs-code',
      type: 'boolean',
    },
  })
  .help();

const { host, port, patchConsole } = argv;

function asDevtoolsJson({ id, title, url: file }) {
  return {
    ...devtoolsJson,
    devtoolsFrontendUrl: `chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=${host}:${port}/${id}`,
    id,
    title,
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
    const sessions = Object.values(bridge.sessions);
    if (argv.latest) {
      sessions.sort((a, b) => b.timestamp - a.timestamp);
      sessions.splice(1);
    }
    const jsonSessions = sessions.map(asDevtoolsJson);
    return response.end(JSON.stringify(jsonSessions));
  }
  if (pathname === '/json/version') {
    return response.end(JSON.stringify(devtoolsVersion));
  }
  logger.warn({ pathname }, 'unsupported endpoint');
  response.statusCode = 400;
  return response.end();
});

server.on('upgrade', (request, socket, head) => {
  const { pathname } = url.parse(request.url);
  logger.debug({ pathname }, 'server upgrade');
  const id = pathname.replace('/', '');
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
