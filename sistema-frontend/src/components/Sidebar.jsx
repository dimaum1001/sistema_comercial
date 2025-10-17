// src/components/Sidebar.jsx (exemplo)
import { Link } from "react-router-dom"

export default function Sidebar() {
  const raw = localStorage.getItem("usuario")
  const usuario = raw ? JSON.parse(raw) : null
  const isAdmin = String(usuario?.tipo || "").toLowerCase() === "admin"

  return (
    <aside className="w-64 p-3 border-r space-y-2">
      <Link className="block px-2 py-1 hover:bg-gray-100 rounded" to="/dashboard">Dashboard</Link>
      {/* ...outros itens */}

      {isAdmin && (
        <>
          <Link className="block px-2 py-1 hover:bg-gray-100 rounded" to="/admin/unidades">
            Unidades de Medida
          </Link>
          <Link className="block px-2 py-1 hover:bg-gray-100 rounded" to="/admin/lgpd">
            Direitos LGPD
          </Link>
          <Link className="block px-2 py-1 hover:bg-gray-100 rounded" to="/admin/auditoria">
            Auditoria
          </Link>
        </>
      )}
    </aside>
  )
}
