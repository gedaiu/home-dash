import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useEffect, useRef, useState } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { logs, clearLogs } from '../state.js';
import { Panel } from './Panel.js';

export function Log() {
  const contentRef = useRef(null);
  const [logList, setLogList] = useState([]);

  useEffect(() => {
    const dispose = effect(() => {
      setLogList([...logs.value]);
    });
    return dispose;
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [logList]);

  const controls = html`
    <button class="btn-icon" onClick=${clearLogs} title="Clear">
      <i data-lucide="trash-2"></i>
    </button>
  `;

  return html`
    <${Panel} panelKey="log" defaultName="SYSTEM LOG" icon="terminal" controls=${controls}>
      <div class="log-content" ref=${contentRef}>
        ${logList.map((entry, i) => html`
          <div class="log-line" key=${i}>
            <span class="log-time">${entry.time}</span>
            <span class="log-msg ${entry.type}">${entry.message}</span>
          </div>
        `)}
      </div>
    <//>
  `;
}
