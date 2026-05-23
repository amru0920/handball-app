import React from 'react'
import ReactDOM from 'react-dom/client'
import HandballApp from './handball_v6'
import './index.css'
console.log('ENV:', import.meta.env.VITE_SUPABASE_URL)
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HandballApp />
  </React.StrictMode>,
)