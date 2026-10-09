import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import { getPanelDisplayName, setPanelDisplayName } from '../state.js';

function panel({ panelKey, defaultName, icon, children, controls }) {
  const displayName = getPanelDisplayName(panelKey, defaultName);
  const editing = usePanelEditing({ panelKey, defaultName, displayName });

  return html`
    <section class="panel" data-panel-key=${panelKey} data-default-name=${defaultName}>
      <div class="panel-header">
        <i data-lucide=${icon}></i>
        ${editing.isEditing ? renderTitleInput(editing) : renderTitle(editing.startEdit, displayName)}
        ${controls}
      </div>
      <div class="panel-content">
        ${children}
      </div>
    </section>
  `;
}

function usePanelEditing({ panelKey, defaultName, displayName }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const startEdit = useCallback(() => {
    setEditValue(displayName);
    setIsEditing(true);
  }, [displayName]);

  const saveEdit = useCallback(() => {
    savePanelName(panelKey, defaultName, editValue.trim());
    setIsEditing(false);
  }, [editValue, panelKey, defaultName]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter') {
      saveEdit();
    }

    if (event.key === 'Escape') {
      setIsEditing(false);
    }
  }, [saveEdit]);

  return { isEditing, editValue, setEditValue, startEdit, saveEdit, handleKeyDown };
}

function savePanelName(panelKey, defaultName, trimmed) {
  if (trimmed && trimmed !== defaultName) {
    setPanelDisplayName(panelKey, trimmed);

    return;
  }

  if (trimmed === defaultName) {
    const names = JSON.parse(localStorage.getItem('panelNames') || '{}');
    delete names[panelKey];
    localStorage.setItem('panelNames', JSON.stringify(names));
  }
}

function renderTitleInput({ editValue, setEditValue, saveEdit, handleKeyDown }) {
  return html`
    <input
      type="text"
      class="inline-edit-input"
      value=${editValue}
      onInput=${(event) => setEditValue(event.target.value)}
      onBlur=${saveEdit}
      onKeyDown=${handleKeyDown}
      autoFocus
    />
  `;
}

function renderTitle(startEdit, displayName) {
  return html`
    <span class="panel-title editable-title" onClick=${startEdit}>${displayName}</span>
  `;
}

function statusBadge({ status, className }) {
  return html`<span class="status-badge ${className}">${status}</span>`;
}

export { panel as Panel, statusBadge as StatusBadge };
