const WebSocket = require('ws');
const pino = require('pino');
const { level } = require('../../config');
const { transpile } = require('../patches/console');

const logger = pino({ name: 'lambda-devtools:bridges:iot', level });

function start(id, { request, socket, head }, Bridge, options = {}) {
  logger.debug({ id }, 'upgrading socket to iot bridge');
  const server = new WebSocket.Server({ noServer: true });
  server.on('connection', (devtools) => {
    logger.debug({ id }, 'devtools connected');

    const receive = (data) => {
      logger.debug({ data }, `lambda/${id} -> devtools`);
      const str = data.toString();
      const message = options.patchConsole
        ? transpile(str) || str
        : str;
      devtools.send(message);
    };
    const bridge = new Bridge(id, receive, { mode: 'devtools', ...options });

    devtools.onmessage('message', (data) => {
      logger.debug({ data }, `devtools -> lambda/${id}`);
      bridge.send(data);
    });

    devtools.onerror((error) => {
      logger.error({ error }, 'devtools error');
    });

    devtools.onclose(() => {
      logger.debug('devtools closed');
      // TODO: anything?
    });
  });
  return server.handleUpdate(request, socket, head, (ws) => {
    server.emit('connection', ws, request);
  });
}

module.exports.start = start;
