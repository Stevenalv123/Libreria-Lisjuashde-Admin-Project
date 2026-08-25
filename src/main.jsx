import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './routers/router.jsx'
import { AuthProvider } from './contexts/authcontext.jsx'
import { Toaster } from 'react-hot-toast'
import { EmpresaProvider } from './contexts/empresacontext.jsx'
import { ThemeProvider } from './contexts/themecontext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <EmpresaProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
          <Toaster position='top-right' toastOptions={{ duration: 3000 }} />
        </ThemeProvider>
      </EmpresaProvider>
    </AuthProvider>
  </StrictMode>,
)