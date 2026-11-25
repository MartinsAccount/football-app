import React from 'react';
import { createRoot } from 'react-dom/client';
import { configure } from 'mobx';
import './design/tokens/tokens.css';
import './design/components/components.css';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerServiceWorker } from './pwa/registerServiceWorker';

// MobX 6 alapból szigorú (observed állapot csak actionben változhat); a v5-ös viselkedést tartjuk (ROADMAP 9.2a, DECISIONS).
configure({ enforceActions: 'never' });

// <React.StrictMode>

createRoot(document.getElementById('root')!).render(
	<React.Fragment>
		<App />
	</React.Fragment>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

registerServiceWorker();
