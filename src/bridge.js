const lambda = require('./adapters/lambda');
const tryParse = require('./utilities/tryParse');
const Bridge = require('./bridges/IotBridge');

function bridge(options) {
  lambda.start(options.inspectorUrl, Bridge, options);
}

const options = tryParse(process.argv[2]);
if (options === null) {
  // TODO: log
  process.exit();
}
bridge(options);
