import { html } from 'https://esm.sh/htm@3.1.1/preact';
import { useState, useEffect } from 'https://esm.sh/preact@10.19.3/hooks';
import { effect } from 'https://esm.sh/@preact/signals@1.2.1';
import { weatherState, transportState } from '../state.js';
import { weatherSection } from './outside/weather.js';
import { transportSection } from './outside/transport.js';

function outsidePage() {
  const [weather, setWeather] = useState(weatherState.value);
  const [transport, setTransport] = useState(transportState.value);

  useEffect(() => {
    const disposeWeather = effect(() => {
      setWeather(weatherState.value);
    });
    const disposeTransport = effect(() => {
      setTransport(transportState.value);
    });

    return () => {
      disposeWeather();
      disposeTransport();
    };
  }, []);

  useEffect(() => {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }, [weather, transport]);

  return html`
    <div class="outside-page">
      <div class="outside-content">
        <${weatherSection} weather=${weather} />
        <${transportSection} transport=${transport} />
      </div>
    </div>
  `;
}

export { outsidePage as OutsidePage };
