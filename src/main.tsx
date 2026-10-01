import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/organic.css';
import './styles/app.css';
import App from './App';
import { AccountProvider } from './account/AccountProvider';
import { registerServiceWorker } from './mobile/push';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AccountProvider>
        <App />
      </AccountProvider>
    </BrowserRouter>
  </StrictMode>,
);
