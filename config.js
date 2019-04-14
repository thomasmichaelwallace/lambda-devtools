const level = (process.env.LAMBDA_DEVTOOLS_DEBUG || 'silent');

module.exports = {
  level: level === '*' ? 'debug' : level,
};
