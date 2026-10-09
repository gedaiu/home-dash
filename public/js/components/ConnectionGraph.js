import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useRef } from 'https://esm.sh/preact@10.19.3/hooks';
import { resolverState } from '../state.js';
import { sendMessage } from '../websocket-preact.js';
import { useSignalMirror } from './shared/signal-hooks.js';
import {
  useParentSize,
  useGraphData,
  useGraphSelection,
  useHover,
  useGraphRendering,
  useCanvasHandlers
} from './connection-graph/graph-hooks.js';

const INITIAL_RESOLVER = { total: 0, resolved: 0, pending: 0, inProgress: false };
const TOOLTIP_OFFSET_X = 10;
const TOOLTIP_OFFSET_Y = 30;

function connectionGraph({ displayMode = 'orgs', showIdleDevices = true }) {
  const canvasRef = useRef(null);
  const positionsRef = useRef(null);
  const dimensions = useParentSize(canvasRef);
  const [resolver] = useSignalMirror(resolverState, INITIAL_RESOLVER);
  const graphData = useGraphData({ displayMode, showIdleDevices });
  const { selection, select } = useGraphSelection(displayMode);
  const { hover, setHover } = useHover();

  useGraphRendering({ canvasRef, positionsRef, graphData, selection, hover, dimensions });

  const { handleCanvasClick, handleCanvasMove } = useCanvasHandlers({
    canvasRef, positionsRef, selection, select, hover, setHover
  });

  return html`
    <div class="radial-graph-container">
      <div class="radial-canvas-wrapper">
        <canvas
          ref=${canvasRef}
          onClick=${handleCanvasClick}
          onMouseMove=${handleCanvasMove}
          onMouseLeave=${() => { setHover.dest(null); setHover.country(null); setHover.device(null); }}
        />
        ${resolverButton(resolver)}
        ${graphData.devices.length === 0 && loadingOverlay()}
        ${hover.device && deviceTooltip(hover.device)}
      </div>
    </div>
  `;
}

function resolverButton(resolver) {
  return html`
    <div class="radial-toggle">
      <button
        class="toggle-btn resolver-btn ${resolver.inProgress ? 'resolving' : ''}"
        onClick=${startResolver}
        disabled=${resolver.inProgress}
      >
        ${resolver.inProgress
          ? `Resolving ${resolver.resolved}/${resolver.total}`
          : 'Resolve Hosts'}
      </button>
    </div>
  `;
}

function startResolver(event) {
  event.stopPropagation();
  console.log('Resolver button clicked');
  sendMessage('resolver:start');
}

function loadingOverlay() {
  return html`
    <div class="radial-loading">
      <div class="loading-orbits">
        <div class="orbit orbit-1"></div>
        <div class="orbit orbit-2"></div>
        <div class="orbit orbit-3"></div>
        <div class="node node-center"></div>
        <div class="node node-1"></div>
        <div class="node node-2"></div>
        <div class="node node-3"></div>
      </div>
      <span class="loading-text">Scanning network...</span>
    </div>
  `;
}

function deviceTooltip(hoveredDevice) {
  return html`
    <div
      class="device-tooltip"
      style="left: ${hoveredDevice.posX + TOOLTIP_OFFSET_X}px; top: ${hoveredDevice.posY - TOOLTIP_OFFSET_Y}px;"
    >
      ${hoveredDevice.name}
    </div>
  `;
}

export { connectionGraph as ConnectionGraph };
