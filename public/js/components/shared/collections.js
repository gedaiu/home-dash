export function getOrCreate(recordsByKey, key, createRecord) {
  if (!recordsByKey.has(key)) {
    recordsByKey.set(key, createRecord());
  }

  return recordsByKey.get(key);
}

export function byDescending(field) {
  return (left, right) => right[field] - left[field];
}
