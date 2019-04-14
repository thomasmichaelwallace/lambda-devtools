const inspector = require('inspector');
const { fork } = require('child_process');

let url;
let bridge;

function inspect({
  enabled = true,
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
  const options = JSON.stringify({ url });
  bridge = fork('./bridge', [options]);
}

module.exports.inspect = inspect;
