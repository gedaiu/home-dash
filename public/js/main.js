import { render } from 'https://esm.sh/preact@10.19.3';
import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { App } from './components/App.js';

render(html`<${App} />`, document.getElementById('app'));
