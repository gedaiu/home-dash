import { computeLayout, positionCountries, positionDevices, positionDestinations } from './layout.js';
import { drawGridRings, drawDeviceConnections, drawDestinationConnections } from './draw-links.js';
import { drawDestinationNodes, drawCountryNodes } from './draw-nodes.js';
import { drawDeviceNodes } from './draw-devices.js';

const BACKGROUND_COLOR = '#0a0a0a';

export function renderGraph(canvas, { graphData, focus }) {
  const ctx = canvas.getContext('2d');
  const { width, height } = sizeCanvas(canvas, ctx);

  if (graphData.devices.length === 0) {
    ctx.clearRect(0, 0, width, height);

    return null;
  }

  const subnets = graphData.subnets || [];
  const layout = computeLayout(width, height, subnets);

  if (!layout) return null;

  ctx.fillStyle = BACKGROUND_COLOR;
  ctx.fillRect(0, 0, width, height);

  const countries = positionCountries(graphData.countries, layout);
  const positions = {
    countries,
    devices: positionDevices(subnets, layout),
    destinations: positionDestinations({
      destinations: graphData.destinations,
      countryPositions: countries,
      selectedCountryCode: focus.selectedCountryCode
    }, layout)
  };

  paintScene(ctx, { layout, positions, focus });

  return positions;
}

function sizeCanvas(canvas, ctx) {
  const { width, height } = canvas.parentElement.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.scale(pixelRatio, pixelRatio);

  return { width, height };
}

function paintScene(ctx, scene) {
  drawGridRings(ctx, scene);
  drawDeviceConnections(ctx, scene);
  drawDestinationConnections(ctx, scene);
  drawDestinationNodes(ctx, scene);
  drawCountryNodes(ctx, scene);
  drawDeviceNodes(ctx, scene);
}
