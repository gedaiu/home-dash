const DEFAULT_COUNTRY_COLOR = '#cc7000';
const COUNTRY_COLORS = {
  'US': '#ff6b35', 'DE': '#ffa500', 'GB': '#ffb347', 'NL': '#ffd700',
  'FR': '#ff9500', 'CN': '#ff4500', 'JP': '#ff7f50', 'KR': '#ff6347',
  'AU': '#ffae42', 'CA': '#ff8c00', 'IE': '#32cd32', 'SG': '#ff69b4'
};

export function getCountryColor(country) {
  return COUNTRY_COLORS[country] || DEFAULT_COUNTRY_COLOR;
}
