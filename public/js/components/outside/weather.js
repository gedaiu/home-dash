import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { WEATHER_ICONS } from './weather-icons.js';
import { CLOTHING_ICONS } from './clothing-icons.js';

const PERIOD_ICON_SIZE = 32;

export function weatherSection({ weather }) {
  if (!weather) {
    return weatherSetupPanel();
  }

  return html`
    <div class="weather-section">
      <${dayPanel} title="TODAY" day=${weather.today} icon="calendar" />
      <${dayPanel} title="TOMORROW" day=${weather.tomorrow} icon="calendar-plus" />
    </div>
  `;
}

function weatherSetupPanel() {
  return html`
    <section class="panel weather-panel">
      <div class="panel-header">
        <i data-lucide="cloud-sun"></i>
        <span>WEATHER</span>
      </div>
      <div class="panel-content">
        <div class="setup-message">
          <p>Weather not configured. Add your OpenWeatherMap API key to network-config.json:</p>
          <code>{ "weather": { "apiKey": "...", "lat": 52.52, "lon": 13.405 } }</code>
        </div>
      </div>
    </section>
  `;
}

function dayPanel({ title, day, icon }) {
  if (!day) { return null; }

  const periods = day.periods;

  return html`
    <section class="panel weather-day-panel">
      <div class="panel-header">
        <i data-lucide="${icon}"></i>
        <span>${title}</span>
        <span class="day-temp-range">${day.minTemp}° / ${day.maxTemp}°</span>
      </div>
      <div class="panel-content">
        <div class="day-periods">
          <${periodForecast} label="Morning" period=${periods?.morning} />
          <${periodForecast} label="Afternoon" period=${periods?.afternoon} />
          <${periodForecast} label="Evening" period=${periods?.evening} />
        </div>
        <div class="day-outfit">
          <h4 class="outfit-title">WHAT TO WEAR</h4>
          <${clothingGrid} clothing=${day.clothing} />
        </div>
      </div>
    </section>
  `;
}

function periodForecast({ label, period }) {
  if (!period) { return null; }

  return html`
    <div class="period-forecast">
      <span class="period-label">${label}</span>
      <${weatherIcon} icon=${period.icon} size=${PERIOD_ICON_SIZE} />
      <span class="period-temp">${period.temp}°</span>
    </div>
  `;
}

function weatherIcon({ icon, size = 64 }) {
  const iconSvg = WEATHER_ICONS[icon] || WEATHER_ICONS.cloudy;

  return html`<div class="weather-icon-wrapper" style="width: ${size}px; height: ${size}px">${iconSvg}</div>`;
}

function clothingGrid({ clothing }) {
  if (!clothing) { return null; }

  const { mainItems, accessories } = splitClothing(clothing);

  if (mainItems.length === 0 && accessories.length === 0) { return null; }

  return html`
    <div class="clothing-sections">
      ${mainItems.length > 0 && html`
        <div class="clothing-grid">${clothingItems(mainItems, 'clothing-item')}</div>
      `}
      ${accessories.length > 0 && accessoriesSection(accessories)}
    </div>
  `;
}

function splitClothing(clothing) {
  const mainItems = [clothing.head, clothing.upper, clothing.lower, clothing.footwear]
    .flatMap(group => group || []);

  return { mainItems, accessories: clothing.accessories || [] };
}

function accessoriesSection(accessories) {
  return html`
    <div class="accessories-section">
      <h5 class="accessories-title">BRING</h5>
      <div class="clothing-grid accessories-grid">
        ${clothingItems(accessories, 'clothing-item accessory')}
      </div>
    </div>
  `;
}

function clothingItems(clothingNames, itemClass) {
  return clothingNames.map(clothingName => html`
    <div class=${itemClass} key=${clothingName}>
      <${clothingIcon} item=${clothingName} />
      <span>${clothingName}</span>
    </div>
  `);
}

function clothingIcon({ item: clothingName }) {
  const iconSvg = CLOTHING_ICONS[clothingName] || CLOTHING_ICONS['t-shirt'];

  return html`<div class="clothing-icon-wrapper">${iconSvg}</div>`;
}
