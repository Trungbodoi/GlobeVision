import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import I18nProvider from './i18n/I18nProvider.jsx'
import AuthProvider from './auth/AuthProvider.jsx'

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </I18nProvider>
)
