module.exports = {
  // devtools client options
  client: {
    host: 'localhost',
    port: 9229,
  },
  // local client defaults
  local: {
    host: 'localhost',
    port: 8080,
    start: true,
    devtoolsPort: 9239,
  },
  // lambda environment patches
  patches: {
    console: true,
  },
  // devtools json response templates
  devtoolsJson: {
    description: 'Remote node.js lambda instance',
    faviconUrl: 'https://upload.wikimedia.org/wikipedia/commons/0/05/AWS_Lambda_logo.svg',
    type: 'page',
  },
  devtoolsVersion: {
    Browser: 'AWS Lambda (node.js/v8.10.0)',
    'Protocol-Version': '1.3',
  },
};
