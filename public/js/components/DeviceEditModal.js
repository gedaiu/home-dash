import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import {
  DEVICE_TYPES,
  DEVICE_COLORS,
  getDeviceCustomization,
  saveDeviceCustomization
} from '../state.js';

export function DeviceEditModal({ device, onClose }) {
  const existing = getDeviceCustomization(device.mac);

  const [name, setName] = useState(existing?.name || device.hostname || '');
  const [type, setType] = useState(existing?.type || 'unknown');
  const [color, setColor] = useState(existing?.color || 'default');
  const [verified, setVerified] = useState(existing?.verified || false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [type]);

  const handleSave = async () => {
    setSaving(true);
    await saveDeviceCustomization(device.mac, {
      name: name.trim() || null,
      type,
      color,
      verified,
      hostname: device.hostname || null
    });
    setSaving(false);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      onClose();
    }
  };

  return html`
    <div class="modal-backdrop" onClick=${handleBackdropClick}>
      <div class="modal device-edit-modal">
        <div class="modal-header">
          <i data-lucide="settings" class="modal-icon"></i>
          <span>Edit Device</span>
          <button class="close-btn" onClick=${onClose}></button>
        </div>

        <div class="modal-body">
          <div class="form-group">
            <label>Name</label>
            <input
              type="text"
              class="form-input"
              value=${name}
              onInput=${(e) => setName(e.target.value)}
              placeholder=${device.hostname || device.mac}
            />
          </div>

          <div class="form-group">
            <label>Device Type</label>
            <div class="device-type-grid">
              ${DEVICE_TYPES.map(dt => html`
                <button
                  class="device-type-btn ${type === dt.id ? 'selected' : ''}"
                  onClick=${() => setType(dt.id)}
                  title=${dt.label}
                >
                  <i data-lucide="${dt.icon}"></i>
                  <span>${dt.label}</span>
                </button>
              `)}
            </div>
          </div>

          <div class="form-group">
            <label>Color</label>
            <div class="color-grid">
              ${DEVICE_COLORS.map(dc => html`
                <button
                  class="color-btn ${color === dc.id ? 'selected' : ''}"
                  style="background: ${dc.color}"
                  onClick=${() => setColor(dc.id)}
                  title=${dc.label}
                />
              `)}
            </div>
          </div>

          <div class="form-group verified-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                checked=${verified}
                onChange=${(e) => setVerified(e.target.checked)}
              />
              <span>Verified device</span>
            </label>
            <p class="form-hint">Mark this device as verified to indicate you've confirmed its identity.</p>
          </div>

          <div class="device-info">
            <div class="info-row">
              <span class="info-label">MAC Address</span>
              <span class="info-value mono">${device.mac}</span>
            </div>
            <div class="info-row">
              <span class="info-label">IP Address</span>
              <span class="info-value mono">${device.ip || 'Unknown'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Hostname</span>
              <span class="info-value">${device.hostname || 'Unknown'}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" onClick=${onClose}>Cancel</button>
          <button class="btn btn-primary" onClick=${handleSave} disabled=${saving}>
            ${saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  `;
}
