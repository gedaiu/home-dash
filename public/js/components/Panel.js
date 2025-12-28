import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useCallback } from 'https://esm.sh/preact@10.19.3/hooks';
import { getPanelDisplayName, setPanelDisplayName } from '../state.js';

export function Panel({ panelKey, defaultName, icon, children, controls }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const displayName = getPanelDisplayName(panelKey, defaultName);

  const startEdit = useCallback(() => {
    setEditValue(displayName);
    setIsEditing(true);
  }, [displayName]);

  const saveEdit = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== defaultName) {
      setPanelDisplayName(panelKey, trimmed);
    } else if (trimmed === defaultName) {
      const names = JSON.parse(localStorage.getItem('panelNames') || '{}');
      delete names[panelKey];
      localStorage.setItem('panelNames', JSON.stringify(names));
    }
    setIsEditing(false);
  }, [editValue, panelKey, defaultName]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  }, [saveEdit]);

  return html`
    <section class="panel" data-panel-key=${panelKey} data-default-name=${defaultName}>
      <div class="panel-header">
        <i data-lucide=${icon}></i>
        ${isEditing ? html`
          <input
            type="text"
            class="inline-edit-input"
            value=${editValue}
            onInput=${(e) => setEditValue(e.target.value)}
            onBlur=${saveEdit}
            onKeyDown=${handleKeyDown}
            autoFocus
          />
        ` : html`
          <span class="panel-title editable-title" onClick=${startEdit}>${displayName}</span>
        `}
        ${controls}
      </div>
      <div class="panel-content">
        ${children}
      </div>
    </section>
  `;
}

export function StatusBadge({ status, className }) {
  return html`<span class="status-badge ${className}">${status}</span>`;
}
