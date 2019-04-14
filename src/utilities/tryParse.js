module.exports = function tryParse(string) {
  try {
    const object = JSON.parse(string);
    return object;
  } catch (_) {
    return null;
  }
};
