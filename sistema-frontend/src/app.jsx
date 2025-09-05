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



const isAuthenticated = () => {
  return !!localStorage.getItem('token')
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
        element={isAuthenticated() ? <Layout /> : <Navigate to="/login" />}
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clientes" element={<Clientes />} />
        <Route path="/clientes/editar/:id" element={<RegisterClient />} />
        <Route path="/clientes/novo" element={<RegisterClient />} />
        <Route path="/produtos" element={<Produtos />} />
        <Route path="/produtos/novo" element={<NovoProduto />} />
        <Route path="/vendas" element={<Vendas />} />
        <Route path="/vendas/novo" element={<NovaVenda />} />
        <Route path="/movimentos" element={<MovimentosEstoque />} />
        <Route path="/fornecedores" element={<Fornecedores />} />
        <Route path="/fornecedores/cadastrar" element={<RegisterFornecedor />} />
        <Route path="/fornecedores/editar/:id" element={<RegisterFornecedor />} />
        <Route path="/usuarios" element={<Usuarios />} />
        <Route path="/usuarios/novo" element={<UsuarioNovo />} />
        <Route path="/usuarios/editar/:id" element={<UsuarioEditar />} />
        <Route path="/produtos/precos" element={<PrecosProdutos />} />
        <Route path="/contas-receber" element={<ContasReceber />} />
      </Route>
    </Routes>
  )
}
