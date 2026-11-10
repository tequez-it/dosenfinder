import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import './styles.css';

// Service Worker: macht die App offline nutzbar und holt Updates automatisch.
registerSW({ immediate: true });

render(<App />, document.getElementById('app')!);
