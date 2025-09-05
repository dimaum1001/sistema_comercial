import { Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'

export default function Layout() {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [financeiroAberto, setFinanceiroAberto] = useState(false) // 🔹 controla submenu

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchUsuario = async () => {
      try {
        const response = await api.get('/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setUsuario(response.data)
      } catch (error) {
        console.error('Erro ao buscar usuário:', error)
        localStorage.removeItem('token')
        navigate('/login')
      }
    }

    fetchUsuario()
  }, [navigate])

  const sair = () => {
    localStorage.removeItem('token')
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar fixa */}
      <aside className="w-64 fixed h-screen bg-white shadow-lg">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-800">Sistema Comercial</h1>
        </div>
        <nav className="p-4 space-y-2">
          {/* Usuário logado */}
          <div className="flex items-center p-3 bg-blue-50 rounded-lg mb-6">
            <div className="bg-blue-100 p-2 rounded-full mr-3">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">
              {usuario?.nome || 'Usuário'}
            </span>
          </div>

          {/* Menus */}
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">📊 Dashboard</button>
          <button onClick={() => navigate('/produtos')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">📦 Produtos</button>
          <button onClick={() => navigate('/clientes')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">👥 Clientes</button>
          <button onClick={() => navigate('/vendas')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">💰 Vendas</button>
          <button onClick={() => navigate('/movimentos')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">🔄 Mov. Estoque</button>
          <button onClick={() => navigate('/fornecedores')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">🏢 Fornecedores</button>
          <button onClick={() => navigate('/produtos/precos')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">💲 Tabela de Preços</button>

          {/* Financeiro com submenu */}
          <div>
            <button
              onClick={() => setFinanceiroAberto(!financeiroAberto)}
              className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-50"
            >
              <span>💼 Financeiro</span>
              <span>{financeiroAberto ? "▲" : "▼"}</span>
            </button>

            {financeiroAberto && (
              <div className="ml-4 mt-1 space-y-1">
                <button
                  onClick={() => navigate('/contas-receber')}
                  className="w-full flex items-center p-2 rounded-lg hover:bg-blue-50 text-sm"
                >
                  📥 Contas a Receber
                </button>
                <button
                  disabled
                  className="w-full flex items-center p-2 rounded-lg text-gray-400 cursor-not-allowed text-sm"
                >
                  📤 Contas a Pagar
                </button>
              </div>
            )}
          </div>

          {/* Apenas Admin pode ver */}
          {usuario?.tipo === 'admin' && (
            <button onClick={() => navigate('/usuarios')} className="w-full flex items-center p-3 rounded-lg hover:bg-blue-50">👤 Usuários</button>
          )}
        </nav>

        {/* Sair */}
        <div className="absolute bottom-4 left-0 w-full px-4">
          <button onClick={sair} className="w-full p-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">🚪 Sair</button>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 md:ml-64 p-6">
        <Outlet />
      </main>
    </div>
  )
}
