import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/organic.css';
import './styles/app.css';
import './styles/theme.css';
import App from './App';
import { AccountProvider } from './account/AccountProvider';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { RotateCover } from './ui/RotateCover';
import { OfflineBar } from './ui/OfflineBar';
import { registerServiceWorker } from './mobile/push';
import { watchSystemTheme } from './lib/theme';

watchSystemTheme();
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AccountProvider>
          <App />
          <RotateCover />
          <OfflineBar />
        </AccountProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
