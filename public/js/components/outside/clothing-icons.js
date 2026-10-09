import { html } from 'https://esm.sh/htm@3.1.1/preact';

// Clothing icons - clear, recognizable designs
export const CLOTHING_ICONS = {
  // HEAD: beanie (winter hat with pom-pom)
  beanie: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="4" r="2"/>
    <path d="M4 16c0-5 4-9 8-9s8 4 8 9"/>
    <path d="M4 16v3h16v-3"/>
    <path d="M4 19h16"/>
  </svg>`,
  // HEAD: cap (baseball cap with brim)
  cap: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 14c0-5 4-8 8-8s8 3 8 8"/>
    <path d="M2 14h20"/>
    <path d="M2 14c0 2 1 3 3 3"/>
    <ellipse cx="12" cy="9" rx="3" ry="1"/>
  </svg>`,
  // HEAD: sunglasses
  sunglasses: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 10l2-4h4"/>
    <path d="M22 10l-2-4h-4"/>
    <rect x="2" y="10" width="7" height="5" rx="2"/>
    <rect x="15" y="10" width="7" height="5" rx="2"/>
    <path d="M9 12h6"/>
  </svg>`,
  // UPPER: coat (long overcoat with lapels, buttons, pockets)
  coat: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- Collar/neck opening -->
    <path d="M9 1h6"/>
    <!-- Main body outline -->
    <path d="M9 1L7 3L5 4L3 6v16h7v-1h4v1h7V6l-2-2-2-1-2-2"/>
    <!-- Pointed lapels -->
    <path d="M7 3l3 4v2"/>
    <path d="M17 3l-3 4v2"/>
    <!-- Lapel fold lines -->
    <path d="M10 7l-2-2"/>
    <path d="M14 7l2-2"/>
    <!-- Buttons down center -->
    <circle cx="12" cy="10" r="0.6" fill="currentColor"/>
    <circle cx="12" cy="13" r="0.6" fill="currentColor"/>
    <circle cx="12" cy="16" r="0.6" fill="currentColor"/>
    <circle cx="12" cy="19" r="0.6" fill="currentColor"/>
    <!-- Pockets with flaps -->
    <path d="M5 14h3v1H5z"/>
    <path d="M5 15v3"/>
    <path d="M8 15v3"/>
    <path d="M16 14h3v1h-3z"/>
    <path d="M16 15v3"/>
    <path d="M19 15v3"/>
    <!-- Sleeve cuffs -->
    <path d="M3 18h2"/>
    <path d="M19 18h2"/>
    <!-- Bottom hem -->
    <path d="M3 22h18"/>
  </svg>`,
  // UPPER: jacket (shorter, casual jacket with zipper)
  jacket: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 3l-2 3v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6l-2-3"/>
    <path d="M6 3h12"/>
    <path d="M9 3c0-1 1.5-1.5 3-1.5s3 .5 3 1.5"/>
    <path d="M12 5v11"/>
    <path d="M4 8h3"/>
    <path d="M17 8h3"/>
  </svg>`,
  // UPPER: sweater (v-neck pullover with cable knit pattern)
  sweater: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <!-- Shoulder line -->
    <path d="M7 2h10"/>
    <!-- Main body with sleeves -->
    <path d="M7 2L3 6v5h4v11h10V11h4V6l-4-4"/>
    <!-- V-neck collar -->
    <path d="M9 2l3 4 3-4"/>
    <!-- Collar ribbing -->
    <path d="M9 2c0 0.5-0.5 1-1 1"/>
    <path d="M15 2c0 0.5 0.5 1 1 1"/>
    <!-- Sleeve seams -->
    <path d="M3 6l4 1"/>
    <path d="M21 6l-4 1"/>
    <!-- Sleeve cuff ribbing -->
    <path d="M3 9h4"/>
    <path d="M17 9h4"/>
    <!-- Cable knit pattern down center -->
    <path d="M10 8c1 1 2 1 2 2s-1 1-2 2 1 1 2 2-1 1-2 2"/>
    <path d="M14 8c-1 1-2 1-2 2s1 1 2 2-1 1-2 2 1 1 2 2"/>
    <!-- Bottom ribbing -->
    <path d="M7 19h10"/>
    <path d="M7 20h10"/>
    <path d="M7 21h10"/>
  </svg>`,
  // UPPER: t-shirt (short sleeves, casual)
  't-shirt': html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 3L2 7v3h4v10h12V10h4V7l-4-4"/>
    <path d="M6 3h12"/>
    <path d="M9 3a3 3 0 0 0 6 0"/>
  </svg>`,
  // LOWER: pants (long trousers)
  pants: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 2h14v5l-2 15H14l-2-10-2 10H7L5 7V2z"/>
    <path d="M5 2h14"/>
    <path d="M5 5h14"/>
    <path d="M12 5v5"/>
  </svg>`,
  // LOWER: shorts (short pants)
  shorts: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 2h14v4l-3 8h-3l-1-4-1 4H8L5 6V2z"/>
    <path d="M5 2h14"/>
    <path d="M5 5h14"/>
    <path d="M12 5v3"/>
  </svg>`,
  // FOOTWEAR: boots (single chelsea boot, side profile)
  boots: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <!-- Boot outline - tall ankle shaft, continuous path -->
    <path d="M5 2 L5 17 C5 18 5.5 19 6.5 19 L20 19 C21 19 22 18.5 22 18 L22 15 C22 14 21 13 19 12 C17 11 16 10 16 8 L16 2"/>
    <!-- Top opening -->
    <path d="M5 2 L16 2"/>
    <!-- Elastic side panel -->
    <rect x="7" y="4" width="5" height="9" rx="1"/>
    <!-- Pull tab at back -->
    <path d="M5 2 L4 1 L5 1"/>
    <!-- Sole - thin layer -->
    <path d="M4 19 L4 21 C4 21.5 4.5 22 5.5 22 L21 22 C22 22 23 21.5 23 21 L23 19"/>
    <!-- Heel separator -->
    <path d="M8 19 L8 22"/>
  </svg>`,
  // FOOTWEAR: sneakers (athletic shoe with laces)
  sneakers: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 15h20a1 1 0 0 1 1 1v2a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-2a1 1 0 0 1 1-1z"/>
    <path d="M4 15V12a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v3"/>
    <path d="M8 12l2 1"/>
    <path d="M11 11l2 1"/>
    <path d="M14 10l2 1"/>
  </svg>`,
  // FOOTWEAR: sandals (open toe with straps)
  sandals: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="7" cy="18" rx="5" ry="3"/>
    <path d="M4 16l3-6"/>
    <path d="M10 16l-3-6"/>
    <path d="M7 10v5"/>
    <ellipse cx="17" cy="18" rx="5" ry="3"/>
    <path d="M14 16l3-6"/>
    <path d="M20 16l-3-6"/>
    <path d="M17 10v5"/>
  </svg>`,
  // ACCESSORY: umbrella (open umbrella)
  umbrella: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2v1"/>
    <path d="M12 3a10 10 0 0 1 10 10H2a10 10 0 0 1 10-10z"/>
    <path d="M12 13v7a2 2 0 0 0 4 0"/>
  </svg>`,
  // ACCESSORY: scarf (draped scarf with hanging ends and fringe)
  scarf: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <!-- Left hanging end (outer) -->
    <path d="M3 1 C2 1 1 2 1 3 L1 18 C1 19 2 20 3 20 L6 20 C7 20 8 19 8 18 L8 6"/>
    <!-- Right hanging end (outer) -->
    <path d="M21 1 C22 1 23 2 23 3 L23 18 C23 19 22 20 21 20 L18 20 C17 20 16 19 16 18 L16 6"/>
    <!-- Curved top connection -->
    <path d="M3 1 C3 1 8 0 12 0 C16 0 21 1 21 1"/>
    <!-- Inner curve line -->
    <path d="M8 6 C8 4 10 3 12 3 C14 3 16 4 16 6"/>
    <!-- Stripe on left end -->
    <path d="M1 5 L8 5"/>
    <!-- Stripe on right end -->
    <path d="M16 5 L23 5"/>
    <!-- Left fringe -->
    <path d="M2 20 L2 23"/>
    <path d="M4 20 L4 23"/>
    <path d="M6 20 L6 23"/>
    <!-- Right fringe -->
    <path d="M18 20 L18 23"/>
    <path d="M20 20 L20 23"/>
    <path d="M22 20 L22 23"/>
  </svg>`,
  // ACCESSORY: gloves (single glove, open palm with spread fingers)
  gloves: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <!-- Thumb -->
    <path d="M5 10 C3.5 9.5 3 8.5 3 7.5 C3 6 4 5 5 5 C6 5 7 6 7 7.5 L7 11"/>
    <!-- Index finger -->
    <path d="M7 11 L7 4 C7 3 7.5 2 8.5 2 C9.5 2 10 3 10 4 L10 11"/>
    <!-- Middle finger -->
    <path d="M10 11 L10 3 C10 2 10.5 1 11.5 1 C12.5 1 13 2 13 3 L13 11"/>
    <!-- Ring finger -->
    <path d="M13 11 L13 4 C13 3 13.5 2 14.5 2 C15.5 2 16 3 16 4 L16 11"/>
    <!-- Pinky finger -->
    <path d="M16 11 L16 6 C16 5 16.5 4 17.5 4 C18.5 4 19 5 19 6 L19 11"/>
    <!-- Palm outline -->
    <path d="M5 10 C5 12 5 14 6 15 L18 15 C19 15 19 14 19 13 L19 11"/>
    <!-- Cuff outline -->
    <path d="M6 15 L6 20 L18 20 L18 15"/>
    <!-- Cuff band -->
    <path d="M6 20 L6 22 L18 22 L18 20"/>
  </svg>`,
  // ACCESSORY: windbreaker (light jacket with hood and wind lines)
  windbreaker: html`<svg viewBox="0 0 24 24" class="clothing-icon" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 4l-2 3v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7l-2-3"/>
    <path d="M6 4h12"/>
    <path d="M9 4a3 3 0 0 0 6 0"/>
    <path d="M8 1c-2 0-3 1.5-3 3"/>
    <path d="M16 1c2 0 3 1.5 3 3"/>
    <path d="M1 10h3"/>
    <path d="M1 13h2"/>
    <path d="M21 10h2"/>
    <path d="M21 13h3"/>
  </svg>`
};
