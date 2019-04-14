const level = (process.env.LAMBDA_DEVTOOLS_DEBUG || 'silent');

module.exports = {
  level: level === '*' ? 'debug' : level,
  ANNOUNCE_TOPIC: 'lambda-devtools/announce',
  LAMBDA_TOPIC_PREFIX: 'lambda-devtools/lambda',
  DEVTOOLS_TOPIC_PREFIX: 'lambda-devtools/devtools',
};
