const BYTES_BASE = 1024;
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'];
const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(BYTES_BASE));

  return (bytes / Math.pow(BYTES_BASE, unitIndex)).toFixed(1) + ' ' + BYTE_UNITS[unitIndex];
}

export function formatDuration(milliseconds) {
  if (milliseconds < MS_PER_SECOND) return 'just now';
  const seconds = Math.floor(milliseconds / MS_PER_SECOND);
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);

  return `${hours}h ${minutes % MINUTES_PER_HOUR}m ago`;
}

export function formatTimeRange(milliseconds) {
  const minutes = Math.floor(milliseconds / MS_PER_MINUTE);
  if (minutes < 1) return '< 1 min';
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMinutes = minutes % MINUTES_PER_HOUR;
  if (remainingMinutes === 0) return `${hours}h`;

  return `${hours}h ${remainingMinutes}m`;
}
