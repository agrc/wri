import '@arcgis/core/assets/esri/themes/light/main.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MapProvider, ProjectProvider } from './components/contexts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProjectProvider>
      <MapProvider>
        <App />
      </MapProvider>
    </ProjectProvider>
  </React.StrictMode>,
);
