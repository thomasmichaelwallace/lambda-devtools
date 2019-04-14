/* eslint-disable no-console */

const A = null;
const B = '__lambda_devtools';

const levels = ['debug', 'info', 'log', 'warn', 'error'];

function patch() {
  if (console.__lambda_devtools_patched === true) { // eslint-disable-line no-underscore-dangle
    return; // prevent nesting patches
  }

  levels.forEach((level) => {
    const type = level === 'warn' ? 'warning' : level;
    console[level] = (...args) => {
      console.dir(A, B, type, ...args);
    };
  });

  console.__lambda_devtools_patched = true; // eslint-disable-line no-underscore-dangle
}

module.exports.patch = patch;
