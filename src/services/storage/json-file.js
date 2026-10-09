const fs = require('node:fs');

const JSON_INDENT = 2;

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, JSON_INDENT), 'utf-8');
}

module.exports = { readJsonFile, writeJsonFile };
