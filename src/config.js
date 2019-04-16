module.exports = {
  // local client defaults
  local: {
    host: 'localhost',
    port: 8080,
    start: true,
    devtoolsPort: 9239,
  },
  client: {
    host: 'localhost',
    port: 9229,
  },
  patches: {
    console: true,
  },
  devtoolsJson: {
    description: 'remove node.js lambda instance',
    faviconUrl: 'https://nodejs.org/static/favicon.ico',
    type: 'node',
  },
  devtoolsVersion: {
    Browser: 'node.js/v8.10.0',
    'Protocol-Version': '1.1',
  },
};
