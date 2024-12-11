import '@arcgis/core/assets/esri/themes/light/main.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MapProvider, ProjectProvider } from './components/contexts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: {
              refetchOnWindowFocus: false,
            },
          },
        })
      }
    >
      <ProjectProvider>
        <MapProvider>
          <App />
        </MapProvider>
      </ProjectProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
