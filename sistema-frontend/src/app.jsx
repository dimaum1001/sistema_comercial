import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Register from './pages/Register'
import RegisterClient from './pages/RegisterClient'
import Clientes from './pages/Clientes'
import Produtos from './pages/Produtos'
import NovoProduto from './pages/NovoProduto'
import NovaVenda from './pages/NovaVenda'
import Vendas from './pages/Vendas'
import MovimentosEstoque from './pages/MovimentosEstoque'
import Layout from './pages/Layout'
import Fornecedores from './pages/Fornecedores'
import RegisterFornecedor from './pages/RegisterFornecedor'
import Usuarios from './pages/Usuarios'
import UsuarioNovo from './pages/UsuarioNovo'
import UsuarioEditar from './pages/UsuarioEditar'
import PrecosProdutos from './pages/PrecosProdutos'
import ContasReceber from './pages/ContasReceber'
// 🔹 Novas páginas
import ContasPagar from './pages/ContasPagar'
import Relatorios from './pages/Relatorios'
import ProdutoEditar from './pages/ProdutoEditar'
import RequireAdmin from './components/RequireAdmin' 
import Auditoria from './pages/Auditoria'

// --------- Controle reativo de autenticação ----------
function Private({ children }) {
  const [ready, setReady] = useState(false)
  const [isAuth, setIsAuth] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    // inicialização
    setIsAuth(!!localStorage.getItem('token'))
    setReady(true)

    // quando Login.jsx disparar 'auth-changed'
    const onAuthChanged = () => setIsAuth(!!localStorage.getItem('token'))
    window.addEventListener('auth-changed', onAuthChanged)

    // mudanças em outra aba
    const onStorage = (e) => {
      if (e.key === 'token' || e.key === 'usuario') {
        setIsAuth(!!localStorage.getItem('token'))
      }
    }
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener('auth-changed', onAuthChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  if (!ready) return null // evita flicker antes de checar token
  return isAuth ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Rotas públicas */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Rotas privadas (todas dentro do Layout) */}
      <Route
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Cadastros */}
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/editar/:id" element={<RegisterClient />} />
        <Route path="/clientes/novo" element={<RegisterClient />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/produtos/novo" element={<NovoProduto />} />
        <Route path="/fornecedores" element={<Fornecedores />} />
        <Route path="/fornecedores/cadastrar" element={<RegisterFornecedor />} />
        <Route path="/fornecedores/editar/:id" element={<RegisterFornecedor />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/usuarios/novo" element={<UsuarioNovo />} />
        <Route path="/usuarios/editar/:id" element={<UsuarioEditar />} />
        <Route path="/produtos/precos" element={<PrecosProdutos />} />
        <Route path="/produtos/editar/:id" element={<ProdutoEditar />} />


        {/* Vendas & Estoque */}
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/vendas/novo" element={<NovaVenda />} />
        <Route path="/movimentos" element={<MovimentosEstoque />} />

        {/* Financeiro */}
        <Route path="/contas-receber" element={<ContasReceber />} />
        <Route path="/contas-pagar" element={<ContasPagar />} />

        {/* Relatórios */}
        <Route path="/relatorios" element={<Relatorios />} />
      </Route>
      {/* Rota protegida apenas para admins */}
      <Route
        path="/admin/auditoria"
        element={
          <Private>
            <RequireAdmin>
              <Auditoria />
            </RequireAdmin>
          </Private>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
