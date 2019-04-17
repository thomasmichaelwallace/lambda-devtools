const WebSocket = require('ws');
const { transpile } = require('../patches/console');
const logger = require('../utilities/logger')('adapters:devtools');

function start(id, { request, socket, head }, clientBridge, options = {}) {
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
      if (devtools.readyState < WebSocket.CLOSING) {
        devtools.send(message);
      } else {
        logger.warn({ message, id }, 'dropped message sent before devtools websocket open');
      }
    };
    const bridge = clientBridge.connect(id, receive);

    devtools.on('message', (data) => {
      logger.debug({ data }, `devtools -> lambda/${id}`);
      bridge.send(data);
    });

    devtools.on('error', (error) => {
      logger.error({ error }, 'devtools error');
    });

    devtools.on('close', () => {
      logger.debug('devtools closed');
      bridge.close();
    });
  });
  return server.handleUpgrade(request, socket, head, (ws) => {
    server.emit('connection', ws, request);
  });
}

module.exports.start = start;
