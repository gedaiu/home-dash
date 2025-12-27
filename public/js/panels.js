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

  element.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const currentName = element.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'inline-edit-input';
    input.value = currentName;

    const restore = (newName) => {
      element.textContent = newName || currentName;
      element.style.display = '';
    };

    const saveAndClose = async () => {
      const newName = input.value.trim();
      if (newName && newName !== defaultName) {
        await API.panels.setName(panelKey, newName);
        panelNames[panelKey] = newName;
        input.remove();
        restore(newName);
      } else if (!newName || newName === defaultName) {
        await API.panels.deleteName(panelKey);
        delete panelNames[panelKey];
        input.remove();
        restore(defaultName);
      }
    };

    input.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        await saveAndClose();
      } else if (e.key === 'Escape') {
        input.remove();
        restore(currentName);
      }
    });

    input.addEventListener('blur', () => {
      input.remove();
      restore(currentName);
    });

    element.style.display = 'none';
    element.parentNode.insertBefore(input, element.nextSibling);
    input.focus();
    input.select();
  });
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
