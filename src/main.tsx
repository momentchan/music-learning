import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './style.css'
import './styles/app.css'
import './styles/practice.css'

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
