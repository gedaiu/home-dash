import { $ } from './utils.js';

export function log(message, type = '') {
  const logContent = $('#log-content');
  const time = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = `
    <span class="log-time">${time}</span>
    <span class="log-msg ${type}">${message}</span>
  `;
  logContent.appendChild(line);
  logContent.scrollTop = logContent.scrollHeight;

  const footer = $('.footer');
  const ekgMonitor = footer.querySelector('.ekg-monitor');
  footer.innerHTML = `
    <div class="footer-content">
      <span class="footer-time">${time}</span>
      <span class="footer-msg">${message}</span>
      <span class="blink">_</span>
    </div>
  `;
  footer.classList.remove('flash');
  void footer.offsetWidth;
  if (ekgMonitor && !footer.contains(ekgMonitor)) {
    footer.appendChild(ekgMonitor);
  }
  footer.classList.add('flash');
}

export function clearLog() {
  $('#log-content').innerHTML = '';
  log('Log cleared');
}

export function initLog() {
  const clearBtn = $('#clear-log');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearLog);
  }
}
