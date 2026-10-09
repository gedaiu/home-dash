import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import {
  openwrtState,
  selectedDeviceMac,
  selectedCountry,
  selectedDestination,
  loadDeviceCustomizations,
  deviceCustomizations
} from '../state.js';
import { ConnectionGraph } from './ConnectionGraph.js';
import { DeviceEditModal } from './DeviceEditModal.js';
import { buildConnectionStats, buildRemoteDestinations, resolveSelectedRecords, sortByIp } from './network/connection-stats.js';
import { setupCard } from './network/setup-card.js';
import { networkControls, routerPanel } from './network/sidebar-controls.js';
import { detailsPanel } from './network/details-panel.js';
import { devicesPanel } from './network/device-list.js';
import { useSignalValue } from './shared/signal-hooks.js';

function networkPage() {
  useEffect(() => {
    loadDeviceCustomizations();
  }, []);

  const selection = {
    mac: useSignalValue(selectedDeviceMac),
    country: useSignalValue(selectedCountry),
    destination: useSignalValue(selectedDestination)
  };
  const [viewMode, setViewMode] = useState('local');
  const [displayMode, setDisplayMode] = useState('orgs');
  const [showIdleDevices, setShowIdleDevices] = useState(true);
  const [editingDevice, setEditingDevice] = useState(null);

  const customizations = useSignalValue(deviceCustomizations);

  useLucideIcons([selection.mac, selection.country, selection.destination, viewMode, customizations]);

  const state = useSignalValue(openwrtState);
  const view = { viewMode, displayMode, showIdleDevices };
  const actions = { setViewMode, setDisplayMode, setShowIdleDevices, setEditingDevice };

  return html`
    <div class="network-page">
      ${state.routers.length > 0 ? networkGrid({ state, selection, view, actions }) : setupCard()}

      ${editingDevice && html`
        <${DeviceEditModal}
          device=${editingDevice}
          onClose=${() => setEditingDevice(null)}
        />
      `}
    </div>
  `;
}

function networkGrid({ state, selection, view, actions }) {
  return html`
    <div class="network-grid">
      <div class="network-graph-panel">
        <${ConnectionGraph}
          displayMode=${view.displayMode}
          showIdleDevices=${view.showIdleDevices}
        />
      </div>

      <div class="network-sidebar">
        ${networkControls({
          displayMode: view.displayMode,
          showIdleDevices: view.showIdleDevices,
          onDisplayModeChange: actions.setDisplayMode,
          onIdleToggle: () => actions.setShowIdleDevices(!view.showIdleDevices)
        })}

        ${state.routers.map(router => routerPanel(router))}

        ${selectionOrDevicesPanel({ state, selection, view, actions })}
      </div>
    </div>
  `;
}

function selectionOrDevicesPanel({ state, selection, view, actions }) {
  const { devices, connections } = state;
  const sortedDevices = sortByIp(devices);

  if (selection.mac || selection.country || selection.destination) {
    const stats = buildConnectionStats({ connections, devices, displayMode: view.displayMode });

    return detailsPanel({
      selection,
      stats,
      selectedRecords: resolveSelectedRecords({ selection, stats, devices: sortedDevices }),
      onEditDevice: actions.setEditingDevice
    });
  }

  return devicesPanel({
    devices: sortedDevices,
    remoteDestinations: buildRemoteDestinations(connections),
    viewMode: view.viewMode,
    selectedMac: selection.mac,
    onViewToggle: () => actions.setViewMode(view.viewMode === 'local' ? 'remote' : 'local')
  });
}

function useLucideIcons(dependencies) {
  useEffect(() => {
    if (window.lucide) {
      requestAnimationFrame(() => {
        window.lucide.createIcons();
      });
    }
  }, dependencies);
}

export { networkPage as NetworkPage };
