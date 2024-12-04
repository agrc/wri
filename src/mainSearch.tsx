import '@arcgis/core/assets/esri/themes/light/main.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './AppSearch';
import { MapProvider } from './components/contexts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MapProvider>
      <App />
    </MapProvider>
  </React.StrictMode>,
);
