const COLD_TEMP = 5;
const CAP_TEMP = 15;
const SUNGLASSES_TEMP = 20;
const HOT_TEMP = 25;
const WINDY_SPEED = 10;

const FREEZING_TEMP = 0;
const COOL_TEMP = 10;
const MILD_TEMP = 18;
const UPPER_LAYERS = [
  { below: FREEZING_TEMP, items: ['coat', 'sweater'] },
  { below: COOL_TEMP, items: ['jacket', 'sweater'] },
  { below: MILD_TEMP, items: ['jacket'] }
];

function getClothingSuggestions(dayAnalysis) {
  if (!dayAnalysis) {
    return { head: [], upper: [], lower: [], footwear: [], accessories: [] };
  }

  return {
    head: headSuggestions(dayAnalysis),
    upper: upperSuggestions(dayAnalysis),
    lower: lowerSuggestions(dayAnalysis),
    footwear: footwearSuggestions(dayAnalysis),
    accessories: accessorySuggestions(dayAnalysis)
  };
}

function headSuggestions(dayAnalysis) {
  const headwear = baseHeadwear(dayAnalysis);
  const wantsSunglasses = dayAnalysis.hasSun && dayAnalysis.maxTemp > SUNGLASSES_TEMP;

  if (!wantsSunglasses) {
    return headwear;
  }

  return headwear.length > 0 ? [...headwear, 'sunglasses'] : ['sunglasses', 'cap'];
}

function baseHeadwear(dayAnalysis) {
  if (dayAnalysis.minFeelsLike < COLD_TEMP) {
    return ['beanie'];
  }

  if (dayAnalysis.minFeelsLike < CAP_TEMP && !dayAnalysis.hasSun) {
    return ['cap'];
  }

  return [];
}

function upperSuggestions(dayAnalysis) {
  const layer = UPPER_LAYERS.find(candidate => dayAnalysis.minFeelsLike < candidate.below);

  return layer ? [...layer.items] : ['t-shirt'];
}

function lowerSuggestions(dayAnalysis) {
  return dayAnalysis.maxTemp > HOT_TEMP && !dayAnalysis.hasRain ? ['shorts'] : ['pants'];
}

function footwearSuggestions(dayAnalysis) {
  if (dayAnalysis.hasRain || dayAnalysis.hasSnow) {
    return ['boots'];
  }

  if (dayAnalysis.minFeelsLike < COOL_TEMP) {
    return ['boots'];
  }

  return dayAnalysis.maxTemp > HOT_TEMP ? ['sandals'] : ['sneakers'];
}

function accessorySuggestions(dayAnalysis) {
  const accessories = [];

  if (dayAnalysis.hasRain) {
    accessories.push('umbrella');
  }

  if (dayAnalysis.minFeelsLike < COLD_TEMP) {
    accessories.push('scarf', 'gloves');
  }

  if (dayAnalysis.maxWind > WINDY_SPEED) {
    accessories.push('windbreaker');
  }

  return accessories;
}

module.exports = { getClothingSuggestions };
