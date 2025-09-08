/// <reference types="@arcgis/map-components/types/react" />
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import initializeTheme from '@ugrc/esri-theme-toggle';
import { FirebaseAppProvider, FirebaseFunctionsProvider } from '@ugrc/utah-design-system';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { MapProvider, ProjectProvider } from './components/contexts';
import './index.css';

initializeTheme();
let firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
};

if (import.meta.env.VITE_FIREBASE_CONFIG) {
  firebaseConfig = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
} else {
  throw new Error('VITE_FIREBASE_CONFIG is not defined');
}

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
      <FirebaseAppProvider config={firebaseConfig}>
        <FirebaseFunctionsProvider>
          <ProjectProvider>
            <MapProvider>
              <App />
            </MapProvider>
          </ProjectProvider>
        </FirebaseFunctionsProvider>
      </FirebaseAppProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
