import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import {
  DEVICE_TYPES,
  DEVICE_COLORS,
  getDeviceCustomization,
  saveDeviceCustomization
} from '../state.js';

function deviceEditModal({ device, onClose }) {
  const form = useDeviceForm(device, onClose);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [form.type]);

  const handleBackdropClick = (event) => {
    const { classList } = event.target;

    if (classList.contains('modal-backdrop')) {
      onClose();
    }
  };

  return html`
    <div class="modal-backdrop" onClick=${handleBackdropClick}>
      <div class="modal device-edit-modal">
        ${renderHeader(onClose)}

        <div class="modal-body">
          ${renderNameField(form, device)}
          ${renderTypeField(form)}
          ${renderColorField(form)}
          ${renderVerifiedField(form)}
          ${renderDeviceInfo(device)}
        </div>

        ${renderFooter(form, onClose)}
      </div>
    </div>
  `;
}

function renderHeader(onClose) {
  return html`
    <div class="modal-header">
      <i data-lucide="settings" class="modal-icon"></i>
      <span>Edit Device</span>
      <button class="close-btn" onClick=${onClose}></button>
    </div>
  `;
}

function useDeviceForm(device, onClose) {
  const initial = initialFormValues(device);
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [color, setColor] = useState(initial.color);
  const [verified, setVerified] = useState(initial.verified);
  const [saving, setSaving] = useState(false);

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

  return { name, setName, type, setType, color, setColor, verified, setVerified, saving, handleSave };
}

function initialFormValues(device) {
  const saved = getDeviceCustomization(device.mac) || {};

  return {
    name: saved.name || device.hostname || '',
    type: saved.type || 'unknown',
    color: saved.color || 'default',
    verified: Boolean(saved.verified)
  };
}

function renderNameField({ name, setName }, device) {
  return html`
    <div class="form-group">
      <label>Name</label>
      <input
        type="text"
        class="form-input"
        value=${name}
        onInput=${(event) => setName(event.target.value)}
        placeholder=${device.hostname || device.mac}
      />
    </div>
  `;
}

function renderTypeField({ type, setType }) {
  return html`
    <div class="form-group">
      <label>Device Type</label>
      <div class="device-type-grid">
        ${DEVICE_TYPES.map(deviceType => html`
          <button
            class="device-type-btn ${type === deviceType.id ? 'selected' : ''}"
            onClick=${() => setType(deviceType.id)}
            title=${deviceType.label}
          >
            <i data-lucide="${deviceType.icon}"></i>
            <span>${deviceType.label}</span>
          </button>
        `)}
      </div>
    </div>
  `;
}

function renderColorField({ color, setColor }) {
  return html`
    <div class="form-group">
      <label>Color</label>
      <div class="color-grid">
        ${DEVICE_COLORS.map(deviceColor => html`
          <button
            class="color-btn ${color === deviceColor.id ? 'selected' : ''}"
            style="background: ${deviceColor.color}"
            onClick=${() => setColor(deviceColor.id)}
            title=${deviceColor.label}
          />
        `)}
      </div>
    </div>
  `;
}

function renderVerifiedField({ verified, setVerified }) {
  return html`
    <div class="form-group verified-group">
      <label class="checkbox-label">
        <input
          type="checkbox"
          checked=${verified}
          onChange=${(event) => setVerified(event.target.checked)}
        />
        <span>Verified device</span>
      </label>
      <p class="form-hint">Mark this device as verified to indicate you've confirmed its identity.</p>
    </div>
  `;
}

function renderDeviceInfo(device) {
  return html`
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
  `;
}

function renderFooter({ saving, handleSave }, onClose) {
  return html`
    <div class="modal-footer">
      <button class="btn btn-secondary" onClick=${onClose}>Cancel</button>
      <button class="btn btn-primary" onClick=${handleSave} disabled=${saving}>
        ${saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  `;
}

export { deviceEditModal as DeviceEditModal };
