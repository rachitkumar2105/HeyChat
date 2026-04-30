// src/index.js
// This is where React starts - the very first file that runs

import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'

// Find the <div id="root"> in public/index.html and put our app inside it
const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
