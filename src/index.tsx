import React from 'react';
import ReactDOM from 'react-dom/client';
import LocalApp from './LocalApp';
// Bootstrap first so our token-based styles (specpad.less) win at equal specificity.
import 'bootstrap/dist/css/bootstrap.css';
import './specpad.less';
import { readStoredTheme, applyTheme } from './theme';

applyTheme(readStoredTheme());

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <LocalApp />
  </React.StrictMode>
);
