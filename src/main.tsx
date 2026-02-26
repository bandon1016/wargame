import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

console.log(
  '%c測試玩法中，歡迎自由探索，但請不要使用暗黑玩法，謝謝配合！',
  'color: #fbbf24; font-size: 16px; font-weight: bold; background: #000; padding: 10px; border-radius: 5px;'
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
