const inspector = require('inspector');
const { fork } = require('child_process');

let url;
let bridge;

function inspect({
  enabled = true,
  local = false,
} = {}) {
  if (!enabled) {
    if (url) {
      inspector.close();
      bridge.kill();
    }
    return;
  }
  if (url || inspector.url()) {
    inspector.close();
  }
  if (bridge) {
    bridge.kill();
  }
  url = (inspector.open() || inspector.url());
  const bridgeModule = local
    ? './bridges/loopback' // TODO: loopback interface
    : './bridges/iot';
  bridge = fork(bridgeModule);
}

module.exports.inspect = inspect;
