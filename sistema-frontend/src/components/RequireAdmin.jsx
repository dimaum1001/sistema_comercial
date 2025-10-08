// src/components/RequireAdmin.jsx
import { Navigate, useLocation } from "react-router-dom"

export default function RequireAdmin({ children }) {
  // pega o usuário do localStorage (mesmo padrão que você já usa no login)
  const raw = localStorage.getItem("usuario")
  const usuario = raw ? JSON.parse(raw) : null
  const location = useLocation()

  // não logado
  if (!usuario) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // não-admin
  const tipo = String(usuario?.tipo || "").toLowerCase()
  if (tipo !== "admin") {
    return <Navigate to="/dashboard" replace />
  }

  // admin segue
  return children
}
