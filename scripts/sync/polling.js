function schedulePolling(poll, getIntervalMs) {
  setTimeout(async () => {
    await poll();
    schedulePolling(poll, getIntervalMs);
  }, getIntervalMs());
}

module.exports = { schedulePolling };
