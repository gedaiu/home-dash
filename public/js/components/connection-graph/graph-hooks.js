import { useEffect, useState } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { openwrtState, selectedDeviceMac, selectedCountry, selectedDestination } from '../../state.js';
import { useSignalMirror } from '../shared/signal-hooks.js';
import { buildConnectionData } from './graph-data.js';
import { renderGraph } from './render.js';
import { findHit, nextSelection, pointerPosition, updateHover } from './interaction.js';

const DATA_REFRESH_INTERVAL_MS = 3000;
const EMPTY_GRAPH_DATA = { devices: [], destinations: [], countries: [], subnets: [] };

export function useParentSize(canvasRef) {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;

      if (canvas && canvas.parentElement) {
        const { width, height } = canvas.parentElement.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return dimensions;
}

export function useGraphData({ displayMode, showIdleDevices }) {
  const [graphData, setGraphData] = useState(EMPTY_GRAPH_DATA);

  useEffect(() => {
    let lastUpdate = 0;

    return effect(() => {
      const state = openwrtState.value;
      const now = Date.now();

      if (now - lastUpdate < DATA_REFRESH_INTERVAL_MS) return;

      lastUpdate = now;
      setGraphData(buildConnectionData({
        connections: state.connections || [],
        devices: state.devices || [],
        displayMode,
        showIdleDevices
      }));
    });
  }, [displayMode, showIdleDevices]);

  return graphData;
}

export function useGraphSelection(displayMode) {
  useEffect(() => {
    setSelectedDest(null);
  }, [displayMode]);

  const [selectedMac, setSelectedMac] = useSignalMirror(selectedDeviceMac, null);
  const [selectedCountryCode, setSelectedCountryCode] = useSignalMirror(selectedCountry, null);
  const [selectedDest, setSelectedDest] = useSignalMirror(selectedDestination, null);

  return {
    selection: { mac: selectedMac, country: selectedCountryCode, destination: selectedDest },
    select: (next) => {
      setSelectedMac(next.mac);
      selectedDeviceMac.value = next.mac;
      setSelectedCountryCode(next.country);
      selectedCountry.value = next.country;
      setSelectedDest(next.destination);
      selectedDestination.value = next.destination;
    }
  };
}

export function useHover() {
  const [country, setCountry] = useState(null);
  const [dest, setDest] = useState(null);
  const [device, setDevice] = useState(null);

  return {
    hover: { country, dest, device },
    setHover: { country: setCountry, dest: setDest, device: setDevice }
  };
}

export function useGraphRendering({ canvasRef, positionsRef, graphData, selection, hover, dimensions }) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const focus = {
      selectedMac: selection.mac,
      selectedCountryCode: selection.country,
      selectedDest: selection.destination,
      hoveredCountry: hover.country,
      hoveredDest: hover.dest
    };
    const positions = renderGraph(canvas, { graphData, focus });

    if (positions) {
      positionsRef.current = positions;
    }
  }, [graphData, selection.mac, selection.country, selection.destination, hover.country, hover.dest, dimensions]);
}

export function useCanvasHandlers({ canvasRef, positionsRef, selection, select, hover, setHover }) {
  const locateHit = (event) => {
    const positions = positionsRef.current;

    return positions ? { hit: findHit(positions, pointerPosition(canvasRef.current, event)) } : null;
  };

  return {
    handleCanvasClick: (event) => {
      const located = locateHit(event);

      if (located) select(nextSelection(located.hit, selection));
    },
    handleCanvasMove: (event) => {
      const located = locateHit(event);

      if (located) updateHover({ hit: located.hit, event, hover, setHover });
    }
  };
}
