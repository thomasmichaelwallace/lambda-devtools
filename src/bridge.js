const lambda = require('./adapters/lambda');
const tryParse = require('./utilities/tryParse');
const bridges = require('./bridges');
const logger = require('./utilities/logger')('bridge');

function bridge(options) {
  logger.debug('bridge forked successfully');
  lambda.start(options.inspectorUrl, bridges(options.type).Lambda, options);
}

const options = tryParse(process.argv[2]);
if (options === null || !options.inspectorUrl) {
  logger.error({ argv: process.argv }, 'bridge started with invalid options');
  process.exit();
}

if (process.connected) {
  bridge(options);
}

module.exports = {
  bridged: function bridged() { return !!process.connected; },
};
