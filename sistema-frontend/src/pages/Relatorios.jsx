// src/pages/Relatorios.jsx
//
// Página de Relatórios
// - Filtro por período (inicio, fim) aplicado a:
//   /relatorios/vendas, /relatorios/produtos-mais-vendidos, /relatorios/ranking-clientes
// - Estoque atual não usa período
// - Ajustes de campos conforme backend:
//   * produtos-mais-vendidos -> { produto, codigo, quantidade, faturamento }
//   * estoque-atual -> { produto, codigo, estoque, estoque_minimo, alerta }
//   * ranking-clientes -> { cliente, total_gasto, qtd_compras }
//   * vendas por período -> { qtd_vendas, total_vendas }

import React, { useEffect, useState } from 'react'
import api from '../services/api'

const fmtBRL = (n) =>
  Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
const fmtInt = (n) => Intl.NumberFormat('pt-BR').format(Number(n || 0))

export default function Relatorios() {
  // Período
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' })

  // Resumo de vendas por período
  const [resumoVendas, setResumoVendas] = useState({ qtd_vendas: 0, total_vendas: 0 })

  // Tabelas
  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState([])
  const [estoqueAtual, setEstoqueAtual] = useState([])
  const [rankingClientes, setRankingClientes] = useState([])

  // Loading/erros
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Carrega apenas o estoque atual ao montar (não depende de período)
  useEffect(() => {
    const loadEstoque = async () => {
      try {
        const { data } = await api.get('/relatorios/estoque-atual')
        setEstoqueAtual(data || [])
      } catch (e) {
        console.error('Erro ao carregar estoque atual:', e)
      }
    }
    loadEstoque()
  }, [])

  const handlePeriodoChange = (e) => {
    setPeriodo((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  const gerarRelatorios = async () => {
    if (!periodo.inicio || !periodo.fim) {
      alert('Por favor, selecione datas de início e fim.')
      return
    }
    setLoading(true)
    setErro('')
    try {
      const params = { inicio: periodo.inicio, fim: periodo.fim }
      const [vendasResp, produtosResp, rankingResp] = await Promise.all([
        api.get('/relatorios/vendas', { params }),
        api.get('/relatorios/produtos-mais-vendidos', { params }),
        api.get('/relatorios/ranking-clientes', { params })
      ])

      // vendas: objeto com { qtd_vendas, total_vendas }
      setResumoVendas({
        qtd_vendas: Number(vendasResp.data?.qtd_vendas || 0),
        total_vendas: Number(vendasResp.data?.total_vendas || 0)
      })

      // produtos mais vendidos: [{ produto, codigo, quantidade, faturamento }]
      setProdutosMaisVendidos(Array.isArray(produtosResp.data) ? produtosResp.data : [])

      // ranking clientes: [{ cliente, total_gasto, qtd_compras }]
      setRankingClientes(Array.isArray(rankingResp.data) ? rankingResp.data : [])
    } catch (e) {
      console.error('Erro ao gerar relatórios:', e)
      setErro(e?.response?.data?.detail || 'Não foi possível gerar os relatórios.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Relatórios</h2>

      {/* Filtro de Período */}
      <div className="bg-white shadow-md rounded px-6 pt-5 pb-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Vendas por Período</h3>

        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-gray-700 text-sm mb-1">Data início</label>
            <input
              type="date"
              name="inicio"
              value={periodo.inicio}
              onChange={handlePeriodoChange}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:shadow-outline"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm mb-1">Data fim</label>
            <input
              type="date"
              name="fim"
              value={periodo.fim}
              onChange={handlePeriodoChange}
              className="shadow border rounded w-full py-2 px-3 text-gray-700 focus:outline-none focus:shadow-outline"
            />
          </div>

          <button
            onClick={gerarRelatorios}
            disabled={loading}
            className={`${
              loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            } text-white font-semibold py-2 px-4 rounded`}
          >
            {loading ? 'Gerando...' : 'Gerar'}
          </button>
        </div>

        {/* Resumo do período */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <div className="text-sm text-gray-600">Quantidade de Vendas</div>
            <div className="text-2xl font-bold text-gray-800">{fmtInt(resumoVendas.qtd_vendas)}</div>
          </div>
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <div className="text-sm text-gray-600">Total do Período</div>
            <div className="text-2xl font-bold text-gray-800">{fmtBRL(resumoVendas.total_vendas)}</div>
          </div>
          <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
            <div className="text-sm text-gray-600">Intervalo Selecionado</div>
            <div className="text-base text-gray-800">
              {periodo.inicio || '—'} → {periodo.fim || '—'}
            </div>
          </div>
        </div>

        {!!erro && (
          <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {erro}
          </div>
        )}
      </div>

      {/* Produtos mais vendidos (filtrado pelo período) */}
      <div className="bg-white shadow-md rounded px-6 pt-5 pb-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Produtos Mais Vendidos</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="text-left">
                <th className="py-2 px-4 border-b">Produto</th>
                <th className="py-2 px-4 border-b">Código</th>
                <th className="py-2 px-4 border-b text-right">Quantidade</th>
                <th className="py-2 px-4 border-b text-right">Faturamento</th>
              </tr>
            </thead>
            <tbody>
              {produtosMaisVendidos.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-center text-gray-500">
                    Nenhum item no período selecionado.
                  </td>
                </tr>
              ) : (
                produtosMaisVendidos.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-4 border-b">{item.produto}</td>
                    <td className="py-2 px-4 border-b">{item.codigo}</td>
                    <td className="py-2 px-4 border-b text-right">{fmtInt(item.quantidade)}</td>
                    <td className="py-2 px-4 border-b text-right">{fmtBRL(item.faturamento)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estoque atual (sem filtro de período) */}
      <div className="bg-white shadow-md rounded px-6 pt-5 pb-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Estoque Atual</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="text-left">
                <th className="py-2 px-4 border-b">Produto</th>
                <th className="py-2 px-4 border-b">Código</th>
                <th className="py-2 px-4 border-b text-right">Estoque</th>
                <th className="py-2 px-4 border-b text-right">Estoque Mínimo</th>
                <th className="py-2 px-4 border-b text-center">Alerta</th>
              </tr>
            </thead>
            <tbody>
              {estoqueAtual.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 px-4 text-center text-gray-500">
                    Nenhum produto cadastrado.
                  </td>
                </tr>
              ) : (
                estoqueAtual.map((p, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-4 border-b">{p.produto}</td>
                    <td className="py-2 px-4 border-b">{p.codigo}</td>
                    <td className="py-2 px-4 border-b text-right">{fmtInt(p.estoque)}</td>
                    <td className="py-2 px-4 border-b text-right">{fmtInt(p.estoque_minimo)}</td>
                    <td className="py-2 px-4 border-b text-center">
                      {p.alerta ? (
                        <span className="text-red-600 font-semibold">Baixo</span>
                      ) : (
                        <span className="text-green-600">OK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ranking de clientes (filtrado pelo período) */}
      <div className="bg-white shadow-md rounded px-6 pt-5 pb-6">
        <h3 className="text-xl font-semibold mb-4">Ranking de Clientes</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="text-left">
                <th className="py-2 px-4 border-b">Cliente</th>
                <th className="py-2 px-4 border-b text-right">Qtde Compras</th>
                <th className="py-2 px-4 border-b text-right">Total Gasto (R$)</th>
              </tr>
            </thead>
            <tbody>
              {rankingClientes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-center text-gray-500">
                    Nenhum cliente no período selecionado.
                  </td>
                </tr>
              ) : (
                rankingClientes.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-4 border-b">{item.cliente}</td>
                    <td className="py-2 px-4 border-b text-right">{fmtInt(item.qtd_compras)}</td>
                    <td className="py-2 px-4 border-b text-right">{fmtBRL(item.total_gasto)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
