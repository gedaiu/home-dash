const { getClothingSuggestions } = require('./clothing');

const MS_PER_SECOND = 1000;
const CLEAR_SKY_CODE = 800;
const RAIN_BAND = { from: 500, to: 600 };
const SNOW_BAND = { from: 600, to: 700 };
const ICON_BANDS = [
  { from: 200, to: 300, icon: 'stormy' },
  { from: 300, to: 400, icon: 'rainy' },
  { ...RAIN_BAND, icon: 'rainy' },
  { from: 600, to: 700, icon: 'snowy' },
  { from: 700, to: 800, icon: 'foggy' }
];
const DAY_PERIODS = [
  { name: 'morning', from: 6, to: 12 },
  { name: 'afternoon', from: 12, to: 18 },
  { name: 'evening', from: 18, to: 24 }
];

function parseForecastData(apiResponse) {
  const { today, tomorrow } = groupForecastByDay(apiResponse.list);
  const current = apiResponse.list[0];

  return {
    current: summarizeCurrent(current),
    today: withClothing(analyzeDayWeather(today)),
    tomorrow: withClothing(analyzeDayWeather(tomorrow)),
    location: apiResponse.city?.name || 'Unknown',
    lastUpdate: new Date().toISOString()
  };
}

function summarizeCurrent(current) {
  const conditions = conditionOf(current);

  return {
    temp: Math.round(current.main.temp),
    feelsLike: Math.round(current.main.feels_like),
    condition: conditions.main,
    conditionCode: conditions.id,
    icon: mapWeatherIcon(conditions.id),
    description: conditions.description,
    humidity: current.main.humidity,
    windSpeed: current.wind.speed
  };
}

function withClothing(analysis) {
  if (!analysis) {
    return null;
  }

  return { ...analysis, clothing: getClothingSuggestions(analysis) };
}

function groupForecastByDay(forecasts) {
  const today = startOfToday();
  const tomorrow = addDays(today, 1);
  const dayAfter = addDays(today, 2);

  return {
    today: forecasts.filter(forecast => isForecastBetween(forecast, today, tomorrow)),
    tomorrow: forecasts.filter(forecast => isForecastBetween(forecast, tomorrow, dayAfter))
  };
}

function isForecastBetween(forecast, from, to) {
  const forecastDate = forecastDateOf(forecast);

  return forecastDate >= from && forecastDate < to;
}

function analyzeDayWeather(forecasts) {
  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  const periods = groupByPeriod(forecasts);

  return {
    ...temperatureRange(forecasts),
    maxWind: Math.max(...forecasts.map(forecast => forecast.wind.speed)),
    hasRain: forecasts.some(forecast => hasPrecipitation(forecast, 'rain', RAIN_BAND)),
    hasSnow: forecasts.some(forecast => hasPrecipitation(forecast, 'snow', SNOW_BAND)),
    hasSun: forecasts.some(forecast => conditionOf(forecast).id === CLEAR_SKY_CODE),
    periods: {
      morning: summarizePeriod(periods.morning),
      afternoon: summarizePeriod(periods.afternoon),
      evening: summarizePeriod(periods.evening)
    }
  };
}

function groupByPeriod(forecasts) {
  const periodEntries = DAY_PERIODS.map(period => [
    period.name,
    forecasts.filter(forecast => isInBand(forecastDateOf(forecast).getHours(), period))
  ]);

  return Object.fromEntries(periodEntries);
}

function summarizePeriod(forecasts) {
  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  const conditions = conditionOf(forecasts[0]);

  return {
    temp: Math.round(average(forecasts.map(forecast => forecast.main.temp))),
    condition: conditions.main,
    conditionCode: conditions.id,
    icon: mapWeatherIcon(conditions.id),
    description: conditions.description
  };
}

function hasPrecipitation(forecast, precipitationKey, band) {
  const volume = forecast[precipitationKey]?.['3h'];

  return volume > 0 || isInBand(conditionOf(forecast).id, band);
}

function temperatureRange(forecasts) {
  const temps = forecasts.map(forecast => forecast.main.temp);
  const feelsLike = forecasts.map(forecast => forecast.main.feels_like);

  return {
    minTemp: Math.round(Math.min(...temps)),
    maxTemp: Math.round(Math.max(...temps)),
    minFeelsLike: Math.round(Math.min(...feelsLike))
  };
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

function addDays(date, dayCount) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + dayCount);

  return shifted;
}

function forecastDateOf(forecast) {
  return new Date(forecast.dt * MS_PER_SECOND);
}

function average(numbers) {
  return numbers.reduce((total, value) => total + value, 0) / numbers.length;
}

function mapWeatherIcon(conditionCode) {
  if (conditionCode === CLEAR_SKY_CODE) {
    return 'sunny';
  }

  const band = ICON_BANDS.find(candidate => isInBand(conditionCode, candidate));

  return band ? band.icon : 'cloudy';
}

function isInBand(value, band) {
  return value >= band.from && value < band.to;
}

function conditionOf(forecast) {
  return forecast.weather[0];
}

module.exports = { parseForecastData, mapWeatherIcon, getClothingSuggestions };
