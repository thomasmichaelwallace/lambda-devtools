const WebSocket = require('ws');
const { inspect } = require('util');
const { transpile } = require('../patches/console');
const logger = require('../utilities/logger')('adapters:devtools');

function start(id, { request, socket, head }, clientBridge, options = {}) {
  logger.debug({ id }, 'upgrading socket to iot bridge');
  const server = new WebSocket.Server({ noServer: true });
  server.on('connection', (devtools) => {
    logger.info({ id }, 'devtools connected');

    const receive = (data) => {
      logger.debug({ data }, `lambda/${id} -> devtools [raw]`);
      const str = data.toString();
      const message = options.patchConsole
        ? transpile(str) || str
        : str;
      if (devtools.readyState < WebSocket.CLOSING) {
        logger.info({ message }, `lambda/${id} -> devtools`);
        devtools.send(message);
      } else {
        logger.warn({ message, id }, 'dropped message sent before devtools websocket open');
      }
    };
    const bridge = clientBridge.connect(id, receive);

    devtools.on('message', (data) => {
      logger.info({ message: data.toString() }, `devtools -> lambda/${id}`);
      bridge.send(data);
    });

    devtools.on('error', (error) => {
      logger.error({ error: inspect(error, true) }, 'devtools error');
    });

    devtools.on('close', () => {
      logger.info({ id }, 'devtools closed');
      bridge.close();
    });
  });
  return server.handleUpgrade(request, socket, head, (ws) => {
    server.emit('connection', ws, request);
  });
}

module.exports.start = start;
