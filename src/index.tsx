import React from 'react';
import ReactDOM from 'react-dom/client';
import LocalApp from './LocalApp';
import './specpad.less';
import 'bootstrap/dist/css/bootstrap.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <LocalApp />
  </React.StrictMode>
);
