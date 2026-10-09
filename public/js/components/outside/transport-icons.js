import { html } from 'https://esm.sh/htm@3.1.1/preact';

// BVG official colors
export const BVG_COLORS = {
  's-bahn': '#006F35',
  'u-bahn': '#115D8C',
  'tram': '#BE1414',
  'bus': '#A5027D',
  'ferry': '#0080BB',
  'train': '#EC1C24',
  'walk': '#666666'
};

// Walk icon for journey legs
export const WALK_ICON = html`<svg viewBox="0 0 24 24" class="walk-icon"><circle cx="12" cy="4" r="2" fill="currentColor"/><path d="M14 7h-4l-1 4 3 3v6h2v-7l-2-2 1-2h3l1 3h2l-2-5z" fill="currentColor"/></svg>`;

// Footprints icon for walk time (Lucide style)
export const WALK_TIME_ICON = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="walk-time-icon"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/></svg>`;
