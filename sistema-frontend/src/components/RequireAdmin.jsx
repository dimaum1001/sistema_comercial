import { Navigate, Outlet, useLocation } from 'react-router-dom'

function readUsuarioFromStorage() {
  const raw = localStorage.getItem('usuario')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('[RequireAdmin] Valor invalido em localStorage.usuario', error)
    localStorage.removeItem('usuario')
    return null
  }
}

export default function RequireAdmin() {
  const location = useLocation()
  const usuario = readUsuarioFromStorage()

  if (!usuario) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  const tipo = String(usuario?.tipo || '').toLowerCase()
  if (tipo !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
