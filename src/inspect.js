const inspector = require('inspector');
const path = require('path');
const { fork } = require('child_process');

let inspectorUrl;
let bridge;

const PORT = 1234;

function inspect({
  enabled = true,
  patchConsole = true,
  iot = false,
} = {}) {
  if (!enabled) {
    if (inspectorUrl) {
      inspector.close();
      bridge.kill();
    }
    return;
  }
  if (inspectorUrl || inspector.url()) {
    inspector.close();
  }
  if (bridge) {
    bridge.kill();
  }
  inspectorUrl = (inspector.open(PORT) || inspector.url());
  const options = JSON.stringify({ inspectorUrl, patchConsole, iot });
  bridge = fork(path.join(__dirname, './bridge'), [options]);
}

module.exports.inspect = inspect;
