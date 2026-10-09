import { API } from './api.js';
import { $$ } from './utils.js';

let panelNames = {};

export async function loadPanelNames() {
  try {
    panelNames = await API.panels.getNames();
  } catch {
    panelNames = {};
  }
}

export function getPanelDisplayName(key, defaultName) {
  return panelNames[key] || defaultName;
}

export function makeEditableTitle(element, panelKey, defaultName) {
  if (element.classList.contains('editable-title')) {
    return;
  }

  element.classList.add('editable-title');
  element.title = 'Double-click to rename';

  element.addEventListener('dblclick', (event) => {
    event.stopPropagation();
    startEditing({ element, panelKey, defaultName });
  });
}

function startEditing({ element, panelKey, defaultName }) {
  const currentName = element.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit-input';
  input.value = currentName;

  const restore = (newName) => {
    element.textContent = newName || currentName;
    element.style.display = '';
  };

  const cancel = () => {
    input.remove();
    restore(currentName);
  };

  const saveAndClose = async () => {
    const savedName = await persistPanelName(panelKey, input.value.trim(), defaultName);
    input.remove();
    restore(savedName);
  };

  input.addEventListener('keydown', (event) => handleEditKey(event, { saveAndClose, cancel }));
  input.addEventListener('blur', cancel);

  element.style.display = 'none';
  element.parentNode.insertBefore(input, element.nextSibling);
  input.focus();
  input.select();
}

async function persistPanelName(panelKey, newName, defaultName) {
  const isCustomName = newName && newName !== defaultName;

  if (isCustomName) {
    await API.panels.setName(panelKey, newName);
    panelNames[panelKey] = newName;

    return newName;
  }

  await API.panels.deleteName(panelKey);
  delete panelNames[panelKey];

  return defaultName;
}

async function handleEditKey(event, { saveAndClose, cancel }) {
  if (event.key === 'Enter') {
    event.preventDefault();
    await saveAndClose();

    return;
  }

  if (event.key === 'Escape') {
    cancel();
  }
}

export function attachEditableTitles() {
  const panels = $$('[data-panel-key]');
  panels.forEach(panel => {
    const panelKey = panel.dataset.panelKey;
    const defaultName = panel.dataset.defaultName;
    const titleEl = panel.querySelector('.panel-title');

    if (titleEl && panelKey && defaultName) {
      makeEditableTitle(titleEl, panelKey, defaultName);
    }
  });
}
