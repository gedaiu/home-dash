import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { weatherState, transportState } from '../state.js';

const WEATHER_ICONS = {
  sunny: html`<svg viewBox="0 0 256 256" class="weather-icon"><circle cx="128" cy="128" r="40" stroke="currentColor" stroke-width="12" fill="none"/><line x1="128" y1="40" x2="128" y2="16" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="128" y1="240" x2="128" y2="216" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="40" y1="128" x2="16" y2="128" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="240" y1="128" x2="216" y2="128" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="65" y1="65" x2="48" y2="48" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="208" y1="208" x2="191" y2="191" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="65" y1="191" x2="48" y2="208" stroke="currentColor" stroke-width="12" stroke-linecap="round"/><line x1="208" y1="48" x2="191" y2="65" stroke="currentColor" stroke-width="12" stroke-linecap="round"/></svg>`,
  cloudy: html`<svg viewBox="0 0 256 256" class="weather-icon"><path d="M80 176a48 48 0 1 1 0-96c2 0 4 .1 6 .3a64 64 0 0 1 124 16.7 48 48 0 0 1-30 79" stroke="currentColor" stroke-width="12" fill="none" stroke-linecap="round"/></svg>`,
  rainy: html`<svg viewBox="0 0 256 256" class="weather-icon"><path d="M80 128a48 48 0 1 1 0-48c2 0 4 .1 6 .3a56 56 0 0 1 108 14.7 40 40 0 0 1-26 65" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/><line x1="96" y1="184" x2="80" y2="224" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><line x1="144" y1="184" x2="128" y2="224" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><line x1="192" y1="184" x2="176" y2="224" stroke="currentColor" stroke-width="10" stroke-linecap="round"/></svg>`,
  stormy: html`<svg viewBox="0 0 256 256" class="weather-icon"><path d="M80 96a48 48 0 1 1 0-48c2 0 4 .1 6 .3a56 56 0 0 1 108 14.7 40 40 0 0 1-26 65" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/><polyline points="144,140 120,180 152,180 128,224" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  snowy: html`<svg viewBox="0 0 256 256" class="weather-icon"><path d="M80 128a48 48 0 1 1 0-48c2 0 4 .1 6 .3a56 56 0 0 1 108 14.7 40 40 0 0 1-26 65" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="96" cy="192" r="8" fill="currentColor"/><circle cx="144" cy="208" r="8" fill="currentColor"/><circle cx="192" cy="192" r="8" fill="currentColor"/><circle cx="120" cy="232" r="8" fill="currentColor"/><circle cx="168" cy="232" r="8" fill="currentColor"/></svg>`,
  foggy: html`<svg viewBox="0 0 256 256" class="weather-icon"><line x1="40" y1="104" x2="216" y2="104" stroke="currentColor" stroke-width="12" stroke-linecap="round" opacity="0.5"/><line x1="40" y1="144" x2="216" y2="144" stroke="currentColor" stroke-width="12" stroke-linecap="round" opacity="0.7"/><line x1="40" y1="184" x2="216" y2="184" stroke="currentColor" stroke-width="12" stroke-linecap="round"/></svg>`
};

const CLOTHING_ICONS = {
  beanie: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <circle cx="128" cy="52" r="12" fill="currentColor"/>
    <path d="M56 152c0-40 32-72 72-72s72 32 72 72" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M56 152v16c0 8 4 16 12 16h120c8 0 12-8 12-16v-16" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M56 168h144" stroke="currentColor" stroke-width="6"/>
    <path d="M72 152v-20M100 152v-32M128 152v-36M156 152v-32M184 152v-20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  cap: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M64 148c0-36 28-64 64-64s64 28 64 64" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M48 148h176" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
    <path d="M48 148c-16 0-24 8-24 20s8 20 24 20" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round"/>
    <ellipse cx="128" cy="100" rx="24" ry="8" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M80 148v-12M176 148v-12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  sunglasses: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="6" cy="15" r="4"/>
    <circle cx="18" cy="15" r="4"/>
    <path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/>
    <path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/>
    <path d="M21.5 13 19 7c-.7-1.3-1.4-2-3-2"/>
  </svg>`,
  coat: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M100 40h56" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>
    <path d="M100 40c-4 0-8 4-8 8v20L56 104v100c0 8 4 12 12 12h28v-56c0-4 4-8 8-8h48c4 0 8 4 8 8v56h28c8 0 12-4 12-12V104l-36-36V48c0-4-4-8-8-8" stroke="currentColor" stroke-width="8" fill="none" stroke-linejoin="round"/>
    <path d="M104 160h48" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M128 68v76" stroke="currentColor" stroke-width="6"/>
    <circle cx="128" cy="84" r="5" fill="currentColor"/>
    <circle cx="128" cy="104" r="5" fill="currentColor"/>
    <circle cx="128" cy="124" r="5" fill="currentColor"/>
    <path d="M92 68L72 88M164 68l20 20" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M68 120h20M168 120h20" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M68 140h16M172 140h16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  jacket: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M100 56h56c4 0 8 4 8 8v12l24 24v88c0 4-4 8-8 8h-24c-4 0-8-4-8-8v-32h-40v32c0 4-4 8-8 8H76c-4 0-8-4-8-8v-88l24-24V64c0-4 4-8 8-8z" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M128 76v80" stroke="currentColor" stroke-width="6"/>
    <circle cx="128" cy="92" r="3" fill="currentColor"/>
    <circle cx="128" cy="112" r="3" fill="currentColor"/>
    <circle cx="128" cy="132" r="3" fill="currentColor"/>
    <path d="M108 56c0-8 8-12 20-12s20 4 20 12" stroke="currentColor" stroke-width="5" fill="none"/>
    <path d="M76 112h12M168 112h12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  sweater: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M108 44c0-8 8-12 20-12s20 4 20 12" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M96 56h64v16h36v36h-36v88H96v-88H60V72h36V56z" stroke="currentColor" stroke-width="8" fill="none" stroke-linejoin="round"/>
    <path d="M60 80h32M164 80h32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M60 96h28M168 96h28" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M96 108c8 4 48 4 64 0" stroke="currentColor" stroke-width="4" fill="none" opacity="0.5"/>
    <path d="M96 128c8 4 48 4 64 0" stroke="currentColor" stroke-width="4" fill="none" opacity="0.5"/>
    <path d="M96 148c8 4 48 4 64 0" stroke="currentColor" stroke-width="4" fill="none" opacity="0.5"/>
    <path d="M96 168c8 4 48 4 64 0" stroke="currentColor" stroke-width="4" fill="none" opacity="0.5"/>
    <path d="M96 188h64" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  </svg>`,
  't-shirt': html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M96 56h64l32 32v24h-24v88H88v-88H64V88l32-32z" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M108 56c0-8 8-12 20-12s20 4 20 12" stroke="currentColor" stroke-width="6" fill="none"/>
    <path d="M100 112h56" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.3"/>
  </svg>`,
  pants: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M68 40h120c4 0 8 4 8 8v48l-28 108c-1 4-4 8-8 8h-20c-4 0-8-4-8-8l-4-72-4 72c0 4-4 8-8 8h-20c-4 0-7-4-8-8L60 96V48c0-4 4-8 8-8z" stroke="currentColor" stroke-width="8" fill="none" stroke-linejoin="round"/>
    <path d="M68 40v24h120V40" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/>
    <path d="M128 64v56" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <circle cx="128" cy="52" r="4" fill="currentColor"/>
    <path d="M96 76h-8M168 76h-8" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M88 100v12M168 100v12" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    <path d="M84 140v16M172 140v16" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
    <path d="M80 180v12M176 180v12" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
  </svg>`,
  shorts: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M72 72h112v28l-20 60h-28c-4 0-8-4-8-8l-8-28-8 28c0 4-4 8-8 8H76l-20-60V72z" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M72 72v16h112V72" stroke="currentColor" stroke-width="6"/>
    <path d="M128 88v32" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <circle cx="108" cy="82" r="3" fill="currentColor"/>
    <path d="M92 92v6M164 92v6" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
  </svg>`,
  boots: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M64 36c0-4 4-8 8-8h24c4 0 8 4 8 8v120H88c-16 0-28 12-28 28v16c0 8 6 16 16 16h56c8 0 16-6 16-16v-16c0-16-12-28-28-28H104V36" stroke="currentColor" stroke-width="8" fill="none" stroke-linejoin="round"/>
    <path d="M152 36c0-4 4-8 8-8h24c4 0 8 4 8 8v120h16c16 0 28 12 28 28v16c0 8-6 16-16 16h-56c-8 0-16-6-16-16v-16c0-16 12-28 28-28h-16V36" stroke="currentColor" stroke-width="8" fill="none" stroke-linejoin="round"/>
    <path d="M72 60h24M160 60h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M72 84h24M160 84h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M72 108h24M160 108h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M72 132h24M160 132h24" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M60 204h72M152 204h48" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
    <path d="M76 184c0-8 8-12 16-12M180 184c0-8-8-12-16-12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  sneakers: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M40 152h176c8 0 16 8 16 20v12c0 8-8 16-16 16H56c-8 0-16-8-16-16v-12c0-12 0-20 0-20z" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M72 152v-24c0-20 20-40 48-40h24c20 0 40 12 48 32v32" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M96 136l16-16M120 136l16-16M144 136l16-16" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <circle cx="56" cy="168" r="8" stroke="currentColor" stroke-width="4" fill="none"/>
    <path d="M72 180h120" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.5"/>
  </svg>`,
  sandals: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <ellipse cx="80" cy="168" rx="48" ry="20" stroke="currentColor" stroke-width="8" fill="none"/>
    <ellipse cx="176" cy="168" rx="48" ry="20" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M56 160c8-32 16-48 24-48M104 160c-8-32-16-48-24-48" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M152 160c8-32 16-48 24-48M200 160c-8-32-16-48-24-48" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M80 148v-24M176 148v-24" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M48 176h64M144 176h64" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity="0.4"/>
  </svg>`,
  umbrella: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 13v7a2 2 0 0 0 4 0"/>
    <path d="M12 2v2"/>
    <path d="M20.992 13a1 1 0 0 0 .97-1.274 10.284 10.284 0 0 0-19.923 0A1 1 0 0 0 3 13z"/>
  </svg>`,
  scarf: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M72 48c0 0 28 32 56 32s56-32 56-32" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M72 48v120c0 24-20 36-36 36" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M128 80v88c0 24 20 36 36 36v36" stroke="currentColor" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M72 76h-8M72 100h-8M72 124h-8M72 148h-8" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M128 108h8M128 132h8M128 156h8" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M156 216h20M156 228h24M156 240h16" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
    <path d="M28 196v12M28 212v8" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  </svg>`,
  gloves: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M56 176v-64c0-16 10-28 24-28s24 12 24 28v40" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M104 132v-56c0-16 10-28 24-28s24 12 24 28v56" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M152 132v-56c0-16 10-28 24-28s24 12 24 28v56" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M200 156v-36c0-16 10-28 24-28s24 12 24 28v60c0 32-24 56-56 56H88c-32 0-56-24-56-56" stroke="currentColor" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M56 192h32M152 192h32" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
    <path d="M80 132v-12M128 104v-12M176 104v-12M224 120v-8" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M72 152c4 0 8-4 8-8M120 136c4 0 8-4 8-8M168 136c4 0 8-4 8-8" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity="0.4"/>
  </svg>`,
  windbreaker: html`<svg viewBox="0 0 256 256" class="clothing-icon">
    <path d="M96 56h64l32 32v20h-24v92H88v-92H64V88l32-32z" stroke="currentColor" stroke-width="8" fill="none"/>
    <path d="M108 56c0-8 8-12 20-12s20 4 20 12" stroke="currentColor" stroke-width="6" fill="none"/>
    <path d="M100 108h56" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M100 132h56" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M100 156h40" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
    <path d="M72 96c-8-8-16-8-24 0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <path d="M184 96c8-8 16-8 24 0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    <circle cx="156" cy="156" r="8" stroke="currentColor" stroke-width="4" fill="none"/>
  </svg>`
};

// BVG official colors
const BVG_COLORS = {
  's-bahn': '#006F35',
  'u-bahn': '#115D8C',
  'tram': '#BE1414',
  'bus': '#A5027D',
  'ferry': '#0080BB',
  'train': '#EC1C24',
  'walk': '#666666'
};

// Walk icon for journey legs
const WALK_ICON = html`<svg viewBox="0 0 24 24" class="walk-icon"><circle cx="12" cy="4" r="2" fill="currentColor"/><path d="M14 7h-4l-1 4 3 3v6h2v-7l-2-2 1-2h3l1 3h2l-2-5z" fill="currentColor"/></svg>`;

// Footprints icon for walk time (Lucide style)
const WALK_TIME_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="walk-time-icon"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`;

function cleanStationName(name) {
  if (!name) return name;
  return name.replace(/\s*\(Berlin\)\s*/gi, '').trim();
}

function LineBadge({ line, type }) {
  const bgColor = BVG_COLORS[type] || '#666';

  if (type === 's-bahn') {
    return html`
      <div class="line-badge s-bahn" style="background: ${bgColor}">
        <span class="line-text">${line}</span>
      </div>
    `;
  }

  if (type === 'u-bahn') {
    return html`
      <div class="line-badge u-bahn" style="background: ${bgColor}">
        <span class="line-text">${line}</span>
      </div>
    `;
  }

  if (type === 'tram') {
    return html`
      <div class="line-badge tram" style="background: ${bgColor}">
        <span class="line-text">${line}</span>
      </div>
    `;
  }

  if (type === 'bus') {
    return html`
      <div class="line-badge bus" style="background: ${bgColor}">
        <span class="line-text">${line}</span>
      </div>
    `;
  }

  if (type === 'ferry') {
    return html`
      <div class="line-badge ferry" style="background: ${bgColor}">
        <span class="line-text">${line}</span>
      </div>
    `;
  }

  if (type === 'train') {
    return html`
      <div class="line-badge train" style="background: ${bgColor}">
        <span class="line-text">${line}</span>
      </div>
    `;
  }

  if (type === 'walk') {
    return html`
      <div class="line-badge walk">
        ${WALK_ICON}
      </div>
    `;
  }

  return html`
    <div class="line-badge unknown" style="background: #666">
      <span class="line-text">${line || '?'}</span>
    </div>
  `;
}

function formatTime(isoString) {
  if (!isoString) { return '--:--'; }
  const date = new Date(isoString);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDelay(minutes) {
  if (!minutes || minutes === 0) { return null; }
  return minutes > 0 ? `+${minutes}` : `${minutes}`;
}

function WeatherIcon({ icon, size = 64 }) {
  const iconSvg = WEATHER_ICONS[icon] || WEATHER_ICONS.cloudy;
  return html`<div class="weather-icon-wrapper" style="width: ${size}px; height: ${size}px">${iconSvg}</div>`;
}

function ClothingIcon({ item }) {
  const iconSvg = CLOTHING_ICONS[item] || CLOTHING_ICONS['t-shirt'];
  return html`<div class="clothing-icon-wrapper">${iconSvg}</div>`;
}


function PeriodForecast({ label, period }) {
  if (!period) { return null; }
  return html`
    <div class="period-forecast">
      <span class="period-label">${label}</span>
      <${WeatherIcon} icon=${period.icon} size=${32} />
      <span class="period-temp">${period.temp}°</span>
    </div>
  `;
}


function ClothingGrid({ clothing }) {
  if (!clothing) { return null; }

  const mainItems = [
    ...(clothing.head || []),
    ...(clothing.upper || []),
    ...(clothing.lower || []),
    ...(clothing.footwear || [])
  ];

  const accessories = clothing.accessories || [];

  if (mainItems.length === 0 && accessories.length === 0) { return null; }

  return html`
    <div class="clothing-sections">
      ${mainItems.length > 0 && html`
        <div class="clothing-grid">
          ${mainItems.map(item => html`
            <div class="clothing-item" key=${item}>
              <${ClothingIcon} item=${item} />
              <span>${item}</span>
            </div>
          `)}
        </div>
      `}
      ${accessories.length > 0 && html`
        <div class="accessories-section">
          <h5 class="accessories-title">BRING</h5>
          <div class="clothing-grid accessories-grid">
            ${accessories.map(item => html`
              <div class="clothing-item accessory" key=${item}>
                <${ClothingIcon} item=${item} />
                <span>${item}</span>
              </div>
            `)}
          </div>
        </div>
      `}
    </div>
  `;
}

function DayPanel({ title, day, icon }) {
  if (!day) { return null; }

  return html`
    <section class="panel weather-day-panel">
      <div class="panel-header">
        <i data-lucide="${icon}"></i>
        <span>${title}</span>
        <span class="day-temp-range">${day.minTemp}° / ${day.maxTemp}°</span>
      </div>
      <div class="panel-content">
        <div class="day-periods">
          <${PeriodForecast} label="Morning" period=${day.periods?.morning} />
          <${PeriodForecast} label="Afternoon" period=${day.periods?.afternoon} />
          <${PeriodForecast} label="Evening" period=${day.periods?.evening} />
        </div>
        <div class="day-outfit">
          <h4 class="outfit-title">WHAT TO WEAR</h4>
          <${ClothingGrid} clothing=${day.clothing} />
        </div>
      </div>
    </section>
  `;
}

function WeatherSection({ weather }) {
  if (!weather) {
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

  return html`
    <div class="weather-section">
      <${DayPanel} title="TODAY" day=${weather.today} icon="calendar" />
      <${DayPanel} title="TOMORROW" day=${weather.tomorrow} icon="calendar-plus" />
    </div>
  `;
}

function DepartureRow({ departure }) {
  return html`
    <div class="departure-row ${departure.cancelled ? 'cancelled' : ''}">
      <${LineBadge} line=${departure.line} type=${departure.transportType} />
      <div class="departure-direction">${departure.direction}</div>
      <div class="departure-time">
        ${formatTime(departure.actualTime)}
        ${departure.delay ? html`<span class="delay ${departure.delay > 0 ? 'late' : 'early'}">${formatDelay(departure.delay)}</span>` : null}
      </div>
    </div>
  `;
}

function DepartureGroup({ title, departures, category }) {
  if (!departures || departures.length === 0) {
    return null;
  }

  return html`
    <div class="departure-group ${category}">
      <div class="departure-group-header">${title}</div>
      <div class="departure-list">
        ${departures.map((dep, i) => html`<${DepartureRow} departure=${dep} key=${i} />`)}
      </div>
    </div>
  `;
}

function StationDepartures({ stationKey, stationData }) {
  const stationName = cleanStationName(stationData?.name) || stationKey;

  if (!stationData || stationData.error) {
    return html`
      <section class="panel station-panel">
        <div class="panel-header">
          <i data-lucide="map-pin"></i>
          <span>${stationName}</span>
        </div>
        <div class="panel-content">
          <div class="station-error">${stationData?.error || 'No data'}</div>
        </div>
      </section>
    `;
  }

  const grouped = stationData.grouped;
  const hasGrouped = grouped && (grouped.hurry?.length > 0 || grouped.now?.length > 0 || grouped.upcoming?.length > 0);

  if (!hasGrouped) {
    return html`
      <section class="panel station-panel">
        <div class="panel-header">
          <i data-lucide="map-pin"></i>
          <span>${stationName}</span>
          ${stationData.walkTime > 0 && html`<span class="walk-time">${WALK_TIME_ICON} ${stationData.walkTime}m</span>`}
        </div>
        <div class="panel-content">
          <div class="no-departures">No catchable departures</div>
        </div>
      </section>
    `;
  }

  return html`
    <section class="panel station-panel">
      <div class="panel-header">
        <i data-lucide="map-pin"></i>
        <span>${stationName}</span>
        ${stationData.walkTime > 0 && html`<span class="walk-time">${WALK_TIME_ICON} ${stationData.walkTime}m</span>`}
      </div>
      <div class="panel-content">
        <div class="departure-groups">
          <${DepartureGroup} title="RUN!" departures=${grouped.hurry} category="hurry" />
          <${DepartureGroup} title="LEAVE NOW" departures=${grouped.now} category="now" />
          <${DepartureGroup} title="UPCOMING" departures=${grouped.upcoming?.slice(0, 5)} category="upcoming" />
        </div>
      </div>
    </section>
  `;
}

function JourneyLeg({ leg, isLast }) {
  return html`
    <div class="journey-leg">
      <${LineBadge} line=${leg.line} type=${leg.transportType} />
      ${!isLast && html`<span class="leg-destination">${leg.destination}</span>`}
    </div>
  `;
}

function JourneyOption({ journey }) {
  const lastIndex = journey.legs.length - 1;
  return html`
    <div class="journey-option ${journey.category || ''}">
      <div class="journey-summary">
        <span class="journey-time">${formatTime(journey.departure)}</span>
        <span class="journey-duration">${journey.duration} min</span>
      </div>
      <div class="journey-legs">
        ${journey.legs.map((leg, i) => html`<${JourneyLeg} leg=${leg} isLast=${i === lastIndex} key=${i} />`)}
      </div>
      <div class="journey-meta">
        <span class="journey-time">${formatTime(journey.arrival)}</span>
        ${journey.transfers > 0 ? html`<span class="journey-transfers">${journey.transfers} ${journey.transfers === 1 ? 'change' : 'changes'}</span>` : null}
        ${journey.totalDelay > 0 ? html`<span class="journey-delay">+${journey.totalDelay} min</span>` : null}
      </div>
    </div>
  `;
}

function JourneyGroup({ title, journeys, category }) {
  if (!journeys || journeys.length === 0) {
    return null;
  }

  return html`
    <div class="journey-group ${category}">
      <div class="journey-group-header">${title}</div>
      <div class="journey-options">
        ${journeys.map((journey, i) => html`<${JourneyOption} journey=${journey} key=${i} />`)}
      </div>
    </div>
  `;
}

function RouteJourneys({ route }) {
  const grouped = route.grouped;
  const hasGrouped = grouped && (grouped.hurry?.length > 0 || grouped.now?.length > 0 || grouped.upcoming?.length > 0);

  if (!hasGrouped) {
    return html`
      <section class="panel route-panel">
        <div class="panel-header">
          <i data-lucide="navigation"></i>
          <span>${route.name}</span>
          ${route.walkTime > 0 && html`<span class="walk-time">${WALK_TIME_ICON} ${route.walkTime}m</span>`}
        </div>
        <div class="panel-content">
          <div class="route-error">${route.error || 'No connections available'}</div>
        </div>
      </section>
    `;
  }

  return html`
    <section class="panel route-panel">
      <div class="panel-header">
        <i data-lucide="navigation"></i>
        <span>${route.name}</span>
        ${route.walkTime > 0 && html`<span class="walk-time">${WALK_TIME_ICON} ${route.walkTime}m</span>`}
      </div>
      <div class="panel-content">
        <div class="journey-groups">
          <${JourneyGroup} title="RUN!" journeys=${grouped.hurry} category="hurry" />
          <${JourneyGroup} title="LEAVE NOW" journeys=${grouped.now} category="now" />
          <${JourneyGroup} title="UPCOMING" journeys=${grouped.upcoming?.slice(0, 3)} category="upcoming" />
        </div>
      </div>
    </section>
  `;
}

function TransportSection({ transport }) {
  const hasStations = transport?.departures && Object.keys(transport.departures).length > 0;
  const hasRoutes = transport?.routes && transport.routes.length > 0;

  if (!hasStations && !hasRoutes) {
    return html`
      <section class="panel transport-panel">
        <div class="panel-header">
          <i data-lucide="train"></i>
          <span>PUBLIC TRANSPORT</span>
        </div>
        <div class="panel-content">
          <div class="setup-message">
            <p>Transport not configured. Add stations to network-config.json:</p>
            <code>{ "transport": { "stations": ["Alexanderplatz"], "routes": [...] } }</code>
          </div>
        </div>
      </section>
    `;
  }

  return html`
    <div class="transport-section">
      ${hasStations && html`
        <div class="transport-stations">
          ${Object.entries(transport.departures).map(([key, data]) =>
            html`<${StationDepartures} stationKey=${key} stationData=${data} key=${key} />`
          )}
        </div>
      `}

      ${hasStations && hasRoutes && html`<div class="transport-divider"></div>`}

      ${hasRoutes && html`
        <div class="transport-routes">
          ${transport.routes.map((route, i) =>
            html`<${RouteJourneys} route=${route} key=${i} />`
          )}
        </div>
      `}
    </div>
  `;
}

export function OutsidePage() {
  const [weather, setWeather] = useState(weatherState.value);
  const [transport, setTransport] = useState(transportState.value);

  useEffect(() => {
    const disposeWeather = effect(() => {
      setWeather(weatherState.value);
    });
    const disposeTransport = effect(() => {
      setTransport(transportState.value);
    });
    return () => {
      disposeWeather();
      disposeTransport();
    };
  }, []);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [weather, transport]);

  return html`
    <div class="outside-page">
      <div class="outside-content">
        <${WeatherSection} weather=${weather} />
        <${TransportSection} transport=${transport} />
      </div>
    </div>
  `;
}
