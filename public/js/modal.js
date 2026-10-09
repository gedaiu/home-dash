import { $ } from './utils.js';

export function showModal(title, content, footer = '') {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = content;
  $('#modal-footer').innerHTML = footer;
  $('#discover-modal').hidden = false;
  lucide.createIcons();
}

function closeModal() {
  $('#discover-modal').hidden = true;
}

export { closeModal as hideModal };
