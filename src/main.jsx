import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import I18nProvider from './i18n/I18nProvider.jsx'
import { clearExpiredCache } from './services/apiClient.js'

clearExpiredCache()

createRoot(document.getElementById('root')).render(
  <I18nProvider>
    <App />
  </I18nProvider>
)
