import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import AppProviders from './app/providers/AppProviders';
import '@xyflow/react/dist/style.css';
import './assets/styles/index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
