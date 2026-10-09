const DEVICE_CATEGORY_RULES = [
  { category: 'motion', keywords: ['motion', 'presence'] },
  { category: 'temperature', keywords: ['temperature'] },
  { category: 'daylight', keywords: ['daylight'] },
  { category: 'switch', keywords: ['switch', 'button', 'dimmer', 'tap'] },
  { category: 'plug', keywords: ['plug'] },
  { category: 'strip', keywords: ['strip'] },
  { category: 'candle', keywords: ['candle'] },
  { category: 'spot', keywords: ['spot', 'recessed'] },
  { category: 'ceiling', keywords: ['pendant', 'ceiling'] },
  { category: 'lamp', keywords: ['floor', 'table', 'lamp'] },
  { category: 'bulb', keywords: ['light', 'bulb'] }
];

const SENSOR_CATEGORY_RULES = [
  { category: 'motion', keywords: ['presence', 'motion'] },
  { category: 'temperature', keywords: ['temperature'] },
  { category: 'lightlevel', keywords: ['lightlevel', 'ambient'] },
  { category: 'daylight', keywords: ['daylight'] },
  { category: 'switch', keywords: ['switch', 'button', 'rotary', 'tap'] }
];

function getDeviceCategory(type) {
  return categorize(type, DEVICE_CATEGORY_RULES, 'device');
}

function getSensorCategory(type) {
  return categorize(type, SENSOR_CATEGORY_RULES, 'sensor');
}

function categorize(type, rules, fallbackCategory) {
  const typeName = (type || '').toLowerCase();
  const matchingRule = rules.find(rule => rule.keywords.some(keyword => typeName.includes(keyword)));

  return matchingRule ? matchingRule.category : fallbackCategory;
}

module.exports = { getDeviceCategory, getSensorCategory };
