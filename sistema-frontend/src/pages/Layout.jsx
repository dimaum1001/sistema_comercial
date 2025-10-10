// src/pages/Layout.jsx
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()

  const [usuario, setUsuario] = useState(null)

  const [open, setOpen] = useState(() => {
    const saved = localStorage.getItem('menuOpen')
    return saved
      ? JSON.parse(saved)
      : { cadastros: true, vendas: true, financeiro: false, relatorios: false, admin: false }
  })

  useEffect(() => {
    localStorage.setItem('menuOpen', JSON.stringify(open))
  }, [open])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }
    const fetchUsuario = async () => {
      try {
        const response = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        setUsuario(response.data)
        // 🔹 garante que RequireAdmin consiga ler sem nova chamada
        localStorage.setItem('usuario', JSON.stringify(response.data))
      } catch (error) {
        console.error('Erro ao buscar usuário:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('usuario')
        navigate('/login')
      }
    }
    fetchUsuario()
  }, [navigate])

  const sair = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    navigate('/login')
  }

  const isActive = (path) => location.pathname.startsWith(path)

  const itemCls = (active) =>
    `w-full flex items-center p-3 rounded-lg transition ${
      active ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50'
    }`

  const subItemCls = (active) =>
    `w-full flex items-center p-2 rounded-lg text-sm transition ${
      active ? 'bg-blue-100 text-blue-700' : 'hover:bg-blue-50'
    }`

  const Section = ({ id, title, icon, children }) => (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => ({ ...o, [id]: !o[id] }))}
        className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-blue-50"
        aria-expanded={open[id]}
        aria-controls={`section-${id}`}
      >
        <span>{icon} {title}</span>
        <span>{open[id] ? '▲' : '▼'}</span>
      </button>
      {open[id] && (
        <div id={`section-${id}`} className="ml-4 mt-1 space-y-1">
          {children}
        </div>
      )}
    </div>
  )

  const relatoriosTab = new URLSearchParams(location.search).get('tab') || ''
  const isRelatorioActive = (tabKey) =>
    location.pathname.startsWith('/relatorios') && relatoriosTab === tabKey

  const isAdmin = String(usuario?.tipo || '').toLowerCase() === 'admin'

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-64 fixed left-0 inset-y-0 bg-white shadow-lg flex flex-col h-screen z-40">
        <div className="p-6 border-b border-gray-100 shrink-0">
          <h1 className="text-xl font-bold text-gray-800">Sistema Comercial</h1>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto pb-6">
          <div className="flex items-center p-3 bg-blue-50 rounded-lg mb-6">
            <div className="bg-blue-100 p-2 rounded-full mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-700">
              {usuario?.nome || 'Usuário'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className={itemCls(isActive('/dashboard'))}
          >
            📊 Dashboard
          </button>

          <Section id="cadastros" title="Cadastros" icon="🗂️">
            <button type="button" onClick={() => navigate('/produtos')} className={subItemCls(isActive('/produtos'))}>📦 Produtos</button>
            <button type="button" onClick={() => navigate('/clientes')} className={subItemCls(isActive('/clientes'))}>👥 Clientes</button>
            <button type="button" onClick={() => navigate('/fornecedores')} className={subItemCls(isActive('/fornecedores'))}>🏢 Fornecedores</button>
          </Section>

          <Section id="vendas" title="Vendas & Estoque" icon="🛒">
            <button type="button" onClick={() => navigate('/vendas')} className={subItemCls(isActive('/vendas'))}>💰 Vendas</button>
            <button type="button" onClick={() => navigate('/movimentos')} className={subItemCls(isActive('/movimentos'))}>🔄 Mov. de Estoque</button>
            <button type="button" onClick={() => navigate('/produtos/precos')} className={subItemCls(isActive('/produtos/precos'))}>💲 Tabela de Preços</button>
          </Section>

          <Section id="financeiro" title="Financeiro" icon="💼">
            <button
              type="button"
              onClick={() => navigate('/contas-receber')}
              className={subItemCls(isActive('/contas-receber'))}
            >
              📥 Contas a Receber
            </button>
            <button
              type="button"
              onClick={() => navigate('/contas-pagar')}
              className={subItemCls(isActive('/contas-pagar'))}
            >
              📤 Contas a Pagar
            </button>
          </Section>

          <Section id="relatorios" title="Relatórios" icon="📈">
            <button
              type="button"
              onClick={() => navigate('/relatorios?tab=vendas-resumo')}
              className={subItemCls(isRelatorioActive('vendas-resumo'))}
            >
              🗓️ Vendas por Período
            </button>
            <button
              type="button"
              onClick={() => navigate('/relatorios?tab=produtos')}
              className={subItemCls(isRelatorioActive('produtos'))}
            >
              🏆 Produtos Mais Vendidos
            </button>
            <button
              type="button"
              onClick={() => navigate('/relatorios?tab=estoque')}
              className={subItemCls(isRelatorioActive('estoque'))}
            >
              📦 Estoque Atual
            </button>
            <button
              type="button"
              onClick={() => navigate('/relatorios?tab=ranking')}
              className={subItemCls(isRelatorioActive('ranking'))}
            >
              👑 Ranking de Clientes
            </button>
          </Section>

          {isAdmin && (
            <Section id="admin" title="Admin" icon="🛡️">
              <button
                type="button"
                onClick={() => navigate('/usuarios')}
                className={subItemCls(isActive('/usuarios'))}
              >
                👤 Usuários
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/auditoria')}
                className={subItemCls(isActive('/admin/auditoria'))}
              >
                📜 Auditoria (Logs)
              </button>
            </Section>
          )}

          <div className="pt-3 mt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={sair}
              className="w-full p-3 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition"
            >
              🚪 Sair
            </button>
          </div>
          <p className="text-[11px] text-center text-gray-400">
            <Link to="/politica-privacidade" className="hover:text-blue-600">Política de Privacidade</Link>
          </p>
        </nav>
      </aside>

      <main className="flex-1 md:ml-64 p-6">
        <Outlet />
      </main>
    </div>
  )
}
