const lambda = require('./adapters/lambda');
const tryParse = require('./utilities/tryParse');
const { IotLambdaBridge } = require('./bridges/Iot');
const logger = require('./utilities/logger')('bridge');

function bridge(options) {
  logger.debug('bridge forked successfully');
  lambda.start(options.inspectorUrl, IotLambdaBridge, options);
}

const options = tryParse(process.argv[2]);
if (options === null || !options.inspectorUrl) {
  logger.error({ argv: process.argv }, 'bridge started with invalid options');
  process.exit();
}
bridge(options);
