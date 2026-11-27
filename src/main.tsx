import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './hooks/usePWAInstall';
import {
  bindServiceWorkerControllerReload,
  markPwaUpdateAvailable,
  registerPwaUpdateController,
} from './lib/pwaUpdater';
import './index.css';

const isFirebaseReservedPath =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/__/');

if (!isFirebaseReservedPath) {
  bindServiceWorkerControllerReload();

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      markPwaUpdateAvailable();
      void updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      registerPwaUpdateController(registration, updateSW);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
