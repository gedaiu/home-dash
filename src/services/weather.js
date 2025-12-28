const storage = require('./storage');

const DEFAULT_POLL_INTERVAL = 900000; // 15 minutes (max ~96 calls/day, well under 1000 limit)
let broadcastFn = null;
let pollTimer = null;
let cachedWeather = null;

function getConfig() {
  return storage.getWeather();
}

function isConfigured() {
  const config = getConfig();
  return !!(config?.apiKey && (config?.location || (config?.lat && config?.lon)));
}

function setBroadcast(fn) {
  broadcastFn = fn;
}

function broadcast(data) {
  if (broadcastFn) {
    broadcastFn({ type: 'weather', data });
  }
}

function logToUI(message, level = 'info') {
  console.log(`[Weather] ${message}`);
  if (broadcastFn) {
    broadcastFn({ type: 'log', data: { source: 'Weather', message, level } });
  }
}

async function fetchForecast() {
  const config = getConfig();
  if (!config?.apiKey) {
    throw new Error('Weather API key not configured');
  }

  const params = config.lat && config.lon
    ? `lat=${config.lat}&lon=${config.lon}`
    : `q=${encodeURIComponent(config.location)}`;

  const url = `https://api.openweathermap.org/data/2.5/forecast?${params}&appid=${config.apiKey}&units=metric`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  return parseForecastData(data);
}

function mapWeatherIcon(conditionCode) {
  if (conditionCode >= 200 && conditionCode < 300) { return 'stormy'; }
  if (conditionCode >= 300 && conditionCode < 400) { return 'rainy'; }
  if (conditionCode >= 500 && conditionCode < 600) { return 'rainy'; }
  if (conditionCode >= 600 && conditionCode < 700) { return 'snowy'; }
  if (conditionCode >= 700 && conditionCode < 800) { return 'foggy'; }
  if (conditionCode === 800) { return 'sunny'; }
  if (conditionCode > 800) { return 'cloudy'; }
  return 'cloudy';
}

function groupForecastByDay(forecasts) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);

  const todayForecasts = [];
  const tomorrowForecasts = [];

  for (const forecast of forecasts) {
    const forecastDate = new Date(forecast.dt * 1000);
    if (forecastDate >= today && forecastDate < tomorrow) {
      todayForecasts.push(forecast);
    } else if (forecastDate >= tomorrow && forecastDate < dayAfter) {
      tomorrowForecasts.push(forecast);
    }
  }

  return { today: todayForecasts, tomorrow: tomorrowForecasts };
}

function groupByPeriod(forecasts) {
  const periods = { morning: [], afternoon: [], evening: [] };

  for (const forecast of forecasts) {
    const hour = new Date(forecast.dt * 1000).getHours();
    if (hour >= 6 && hour < 12) {
      periods.morning.push(forecast);
    } else if (hour >= 12 && hour < 18) {
      periods.afternoon.push(forecast);
    } else if (hour >= 18 && hour < 24) {
      periods.evening.push(forecast);
    }
  }

  return periods;
}

function summarizePeriod(forecasts) {
  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  const temps = forecasts.map(f => f.main.temp);
  const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
  const conditions = forecasts[0].weather[0];

  return {
    temp: avgTemp,
    condition: conditions.main,
    conditionCode: conditions.id,
    icon: mapWeatherIcon(conditions.id),
    description: conditions.description
  };
}

function analyzeDayWeather(forecasts) {
  if (!forecasts || forecasts.length === 0) {
    return null;
  }

  const temps = forecasts.map(f => f.main.temp);
  const feelsLike = forecasts.map(f => f.main.feels_like);
  const winds = forecasts.map(f => f.wind.speed);
  const hasRain = forecasts.some(f => f.rain?.['3h'] > 0 || (f.weather[0].id >= 500 && f.weather[0].id < 600));
  const hasSnow = forecasts.some(f => f.snow?.['3h'] > 0 || (f.weather[0].id >= 600 && f.weather[0].id < 700));
  const hasSun = forecasts.some(f => f.weather[0].id === 800);

  const periods = groupByPeriod(forecasts);

  return {
    minTemp: Math.round(Math.min(...temps)),
    maxTemp: Math.round(Math.max(...temps)),
    minFeelsLike: Math.round(Math.min(...feelsLike)),
    maxWind: Math.max(...winds),
    hasRain,
    hasSnow,
    hasSun,
    periods: {
      morning: summarizePeriod(periods.morning),
      afternoon: summarizePeriod(periods.afternoon),
      evening: summarizePeriod(periods.evening)
    }
  };
}

function getClothingSuggestions(dayAnalysis) {
  if (!dayAnalysis) {
    return { head: [], upper: [], lower: [], footwear: [], accessories: [] };
  }

  const suggestions = {
    head: [],
    upper: [],
    lower: [],
    footwear: [],
    accessories: []
  };

  const effectiveTemp = dayAnalysis.minFeelsLike;
  const maxTemp = dayAnalysis.maxTemp;

  // Head suggestions
  if (effectiveTemp < 5) {
    suggestions.head.push('beanie');
  } else if (effectiveTemp < 15 && !dayAnalysis.hasSun) {
    suggestions.head.push('cap');
  }
  if (dayAnalysis.hasSun && maxTemp > 20) {
    suggestions.head.push('sunglasses');
    if (!suggestions.head.includes('cap') && !suggestions.head.includes('beanie')) {
      suggestions.head.push('cap');
    }
  }

  // Upper body - based on minimum temperature
  if (effectiveTemp < 0) {
    suggestions.upper.push('coat', 'sweater');
  } else if (effectiveTemp < 10) {
    suggestions.upper.push('jacket', 'sweater');
  } else if (effectiveTemp < 18) {
    suggestions.upper.push('jacket');
  } else {
    suggestions.upper.push('t-shirt');
  }

  // Lower body - based on maximum temperature
  if (maxTemp > 25 && !dayAnalysis.hasRain) {
    suggestions.lower.push('shorts');
  } else {
    suggestions.lower.push('pants');
  }

  // Footwear
  if (dayAnalysis.hasRain || dayAnalysis.hasSnow) {
    suggestions.footwear.push('boots');
  } else if (effectiveTemp < 10) {
    suggestions.footwear.push('boots');
  } else if (maxTemp > 25) {
    suggestions.footwear.push('sandals');
  } else {
    suggestions.footwear.push('sneakers');
  }

  // Accessories
  if (dayAnalysis.hasRain) {
    suggestions.accessories.push('umbrella');
  }
  if (effectiveTemp < 5) {
    suggestions.accessories.push('scarf', 'gloves');
  }
  if (dayAnalysis.maxWind > 10) {
    suggestions.accessories.push('windbreaker');
  }

  return suggestions;
}

function parseForecastData(data) {
  const { today, tomorrow } = groupForecastByDay(data.list);

  const todayAnalysis = analyzeDayWeather(today);
  const tomorrowAnalysis = analyzeDayWeather(tomorrow);

  const current = data.list[0];
  const currentConditions = current.weather[0];

  return {
    current: {
      temp: Math.round(current.main.temp),
      feelsLike: Math.round(current.main.feels_like),
      condition: currentConditions.main,
      conditionCode: currentConditions.id,
      icon: mapWeatherIcon(currentConditions.id),
      description: currentConditions.description,
      humidity: current.main.humidity,
      windSpeed: current.wind.speed
    },
    today: todayAnalysis ? {
      ...todayAnalysis,
      clothing: getClothingSuggestions(todayAnalysis)
    } : null,
    tomorrow: tomorrowAnalysis ? {
      ...tomorrowAnalysis,
      clothing: getClothingSuggestions(tomorrowAnalysis)
    } : null,
    location: data.city?.name || 'Unknown',
    lastUpdate: new Date().toISOString()
  };
}

async function poll() {
  if (!isConfigured()) {
    return;
  }

  try {
    cachedWeather = await fetchForecast();
    logToUI(`${cachedWeather.location}: ${cachedWeather.current.temp}C, ${cachedWeather.current.condition}`);
    broadcast(cachedWeather);
  } catch (err) {
    logToUI(`Poll error: ${err.message}`, 'error');
  }
}

function startPolling() {
  const config = getConfig();
  console.log('[weather] startPolling called, config:', JSON.stringify(config));
  console.log('[weather] isConfigured:', isConfigured());

  if (pollTimer) {
    console.log('[weather] Poll timer already running');
    return;
  }

  if (!isConfigured()) {
    console.log('[weather] Not configured, skipping');
    return;
  }

  const interval = config?.pollInterval || DEFAULT_POLL_INTERVAL;

  console.log('[weather] Starting polling every', Math.round(interval / 60000), 'min');
  pollTimer = setInterval(poll, interval);
  poll();
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logToUI('Stopped polling');
  }
}

function getStatus() {
  return cachedWeather;
}

module.exports = {
  isConfigured,
  getConfig,
  getStatus,
  fetchForecast,
  setBroadcast,
  startPolling,
  stopPolling,
  getClothingSuggestions,
  mapWeatherIcon
};
