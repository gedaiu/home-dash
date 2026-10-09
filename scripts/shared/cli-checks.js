function exitWhen(condition, message) {
  if (!condition) {
    return;
  }

  console.log(message);
  process.exit(1);
}

function hasValues(section, keys) {
  return keys.every(key => section?.[key]);
}

module.exports = { exitWhen, hasValues };
