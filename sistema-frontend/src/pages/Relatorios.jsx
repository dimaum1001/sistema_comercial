// src/pages/Relatorios.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const fmtBRL = (n) =>
  Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
const fmtInt = (n) => Intl.NumberFormat('pt-BR').format(Number(n || 0))
const toISO = (d) => d.toISOString().slice(0, 10)

export default function Relatorios() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = useMemo(() => new URLSearchParams(location.search), [location.search])

  const initialTab = search.get('tab') || 'vendas-resumo'
  const [tab, setTab] = useState(initialTab)
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' })

  const [resumoVendas, setResumoVendas] = useState({ qtd_vendas: 0, total_vendas: 0 })
  const [detalhesVendas, setDetalhesVendas] = useState([])
  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState([])
  const [rankingClientes, setRankingClientes] = useState([])
  const [estoqueAtual, setEstoqueAtual] = useState([])

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [estoqueLoaded, setEstoqueLoaded] = useState(false)

  useEffect(() => {
    const t = search.get('tab') || 'vendas-resumo'
    setTab(t)
  }, [search])

  useEffect(() => {
    const today = new Date()
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const inicio = toISO(first)
    const fim = toISO(today)
    setPeriodo({ inicio, fim })
    ;(async () => {
      await carregarResumoVendas({ inicio, fim })
      await carregarVendasDetalhadas({ inicio, fim })
    })()
  }, [])

  useEffect(() => {
    if (tab === 'estoque' && !estoqueLoaded) {
      carregarEstoque()
    }
  }, [tab])

  const handlePeriodoChange = (e) => {
    setPeriodo((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  const pushTab = (t) => {
    const params = new URLSearchParams(location.search)
    params.set('tab', t)
    navigate(`/relatorios?${params.toString()}`, { replace: true })
  }

  const carregarEstoque = async () => {
    try {
      const { data } = await api.get('/relatorios/estoque-atual')
      const arr = data || []
      setEstoqueAtual(arr)
      setEstoqueLoaded(true)
      return arr // <- retorna dados para uso imediato no PDF
    } catch (e) {
      console.error('Erro ao carregar estoque atual:', e)
      return []
    }
  }

  const carregarResumoVendas = async (p) => {
    const useP = p || periodo
    try {
      const { data } = await api.get('/relatorios/vendas', { params: useP })
      setResumoVendas({
        qtd_vendas: Number(data?.qtd_vendas || 0),
        total_vendas: Number(data?.total_vendas || 0)
      })
    } catch (e) {
      console.error('Erro ao carregar resumo de vendas:', e)
      setErro('Não foi possível carregar resumo de vendas.')
    }
  }

  const carregarVendasDetalhadas = async (p) => {
    const useP = p || periodo
    try {
      const { data } = await api.get('/relatorios/vendas/detalhadas', { params: useP })
      setDetalhesVendas(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('Erro ao carregar vendas detalhadas:', e)
      setDetalhesVendas([])
    }
  }

  const carregarOutrosRelatorios = async (p) => {
    const useP = p || periodo
    try {
      const [produtosRes, rankingRes] = await Promise.allSettled([
        api.get('/relatorios/produtos-mais-vendidos', { params: useP }),
        api.get('/relatorios/ranking-clientes', { params: useP })
      ])
      if (produtosRes.status === 'fulfilled') {
        setProdutosMaisVendidos(Array.isArray(produtosRes.value.data) ? produtosRes.value.data : [])
      }
      if (rankingRes.status === 'fulfilled') {
        setRankingClientes(Array.isArray(rankingRes.value.data) ? rankingRes.value.data : [])
      }
    } catch (e) {
      console.error('Erro ao carregar relatórios adicionais:', e)
    }
  }

  const aplicarPeriodo = async () => {
    setLoading(true)
    setErro('')
    try {
      await Promise.all([
        carregarResumoVendas(),
        carregarVendasDetalhadas(),
        carregarOutrosRelatorios()
      ])
      if (tab === 'estoque') await carregarEstoque()
    } finally {
      setLoading(false)
    }
  }

  // === Exportação para PDF (agora cobre Estoque e garante dados carregados) ===
  const exportarPDF = async () => {
    const doc = new jsPDF()
    const titulos = {
      'vendas-resumo': 'Resumo de Vendas',
      'vendas-detalhadas': 'Vendas Detalhadas',
      produtos: 'Produtos Mais Vendidos',
      estoque: 'Estoque Atual',
      ranking: 'Ranking de Clientes'
    }
    const titulo = `Relatório - ${titulos[tab]}`
    doc.setFontSize(14)
    doc.text(titulo, 14, 15)
    doc.setFontSize(10)
    doc.text(`Período: ${periodo.inicio || '—'} → ${periodo.fim || '—'}`, 14, 22)
    const startY = 28

    if (tab === 'vendas-resumo') {
      autoTable(doc, {
        startY,
        head: [['Métrica', 'Valor']],
        body: [
          ['Quantidade de Vendas', fmtInt(resumoVendas.qtd_vendas)],
          ['Total do Período', fmtBRL(resumoVendas.total_vendas)]
        ]
      })
    } else if (tab === 'vendas-detalhadas') {
      autoTable(doc, {
        startY,
        head: [['Data', 'Cliente', 'Total', 'Itens']],
        body: detalhesVendas.map((v) => [
          v.data_venda,
          v.cliente || '—',
          fmtBRL(v.total),
          v.itens?.map((i) => `${i.produto} (x${i.quantidade})`).join(', ')
        ])
      })
    } else if (tab === 'produtos') {
      autoTable(doc, {
        startY,
        head: [['Produto', 'Código', 'Quantidade', 'Faturamento']],
        body: produtosMaisVendidos.map((item) => [
          item.produto,
          item.codigo ?? '—',
          fmtInt(item.quantidade),
          fmtBRL(item.faturamento)
        ])
      })
    } else if (tab === 'estoque') {
      // garante ter dados do estoque; usa retorno imediato para montar a tabela
      const dataEstoque = estoqueLoaded ? estoqueAtual : await carregarEstoque()
      autoTable(doc, {
        startY,
        head: [['Produto', 'Código', 'Estoque', 'Estoque Mínimo', 'Alerta']],
        body: (dataEstoque || []).map((p) => [
          p.produto,
          p.codigo ?? '—',
          fmtInt(p.estoque),
          fmtInt(p.estoque_minimo),
          p.alerta ? 'Baixo' : 'OK'
        ])
      })
    } else if (tab === 'ranking') {
      autoTable(doc, {
        startY,
        head: [['Cliente', 'Qtde Compras', 'Total Gasto']],
        body: rankingClientes.map((item) => [
          item.cliente,
          fmtInt(item.qtd_compras),
          fmtBRL(item.total_gasto)
        ])
      })
    }

    doc.save(`relatorio-${tab}.pdf`)
  }
  // === fim exportação ===

  const HeaderPeriodo = () => (
    <div className="bg-white shadow-md rounded px-6 pt-5 pb-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Período</h3>
      <div className="flex flex-wrap items-end gap-4 mb-4">
        <input type="date" name="inicio" value={periodo.inicio} onChange={handlePeriodoChange} className="shadow border rounded py-2 px-3" />
        <input type="date" name="fim" value={periodo.fim} onChange={handlePeriodoChange} className="shadow border rounded py-2 px-3" />
        <button onClick={aplicarPeriodo} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading ? 'Atualizando...' : 'Aplicar período'}
        </button>
        <button onClick={exportarPDF} className="bg-green-600 text-white px-4 py-2 rounded">Exportar PDF</button>
      </div>
    </div>
  )

  const Tabs = () => (
    <div className="mb-4 flex gap-2">
      {[
        { key: 'vendas-resumo', label: 'Resumo de Vendas' },
        { key: 'vendas-detalhadas', label: 'Vendas Detalhadas' },
        { key: 'produtos', label: 'Produtos Mais Vendidos' },
        { key: 'estoque', label: 'Estoque Atual' },
        { key: 'ranking', label: 'Ranking de Clientes' }
      ].map((t) => (
        <button key={t.key} onClick={() => pushTab(t.key)} className={`px-4 py-2 rounded border ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-white'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Relatórios</h2>
      <Tabs />

      {tab === 'vendas-resumo' && (
        <>
          <HeaderPeriodo />
          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-semibold mb-4">Resumo de Vendas</h3>
            <p>Total de vendas: {fmtInt(resumoVendas.qtd_vendas)}</p>
            <p>Valor total: {fmtBRL(resumoVendas.total_vendas)}</p>
          </div>
        </>
      )}

      {tab === 'vendas-detalhadas' && (
        <>
          <HeaderPeriodo />
          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-semibold mb-4">Vendas Detalhadas</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-2 px-3">Data</th>
                    <th className="text-left py-2 px-3">Cliente</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="text-left py-2 px-3">Itens</th>
                  </tr>
                </thead>
                <tbody>
                  {detalhesVendas.map((v, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="py-2 px-3">{v.data_venda}</td>
                      <td className="py-2 px-3">{v.cliente || '—'}</td>
                      <td className="py-2 px-3 text-right">{fmtBRL(v.total)}</td>
                      <td className="py-2 px-3">
                        {v.itens?.map((i, ix) => (
                          <div key={ix}>{i.produto} (x{i.quantidade})</div>
                        ))}
                      </td>
                    </tr>
                  ))}
                  {detalhesVendas.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-4 text-gray-500">
                        Nenhuma venda encontrada neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'produtos' && (
        <>
          <HeaderPeriodo />
          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-semibold mb-4">Produtos Mais Vendidos</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Código</th>
                    <th className="text-right">Quantidade</th>
                    <th className="text-right">Faturamento</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosMaisVendidos.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.produto}</td>
                      <td>{item.codigo}</td>
                      <td className="text-right">{fmtInt(item.quantidade)}</td>
                      <td className="text-right">{fmtBRL(item.faturamento)}</td>
                    </tr>
                  ))}
                  {produtosMaisVendidos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-2">Nenhum item encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'estoque' && (
        <div className="bg-white p-6 rounded shadow">
          {/* Topo com botão de PDF nesta tela */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Estoque Atual</h3>
            <button
              onClick={exportarPDF}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded"
              aria-label="Exportar estoque em PDF"
            >
              Exportar PDF
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left">
                  <th className="py-2 px-4">Produto</th>
                  <th className="py-2 px-4">Código</th>
                  <th className="py-2 px-4 text-right">Estoque</th>
                  <th className="py-2 px-4 text-right">Estoque Mínimo</th>
                  <th className="py-2 px-4 text-center">Alerta</th>
                </tr>
              </thead>
              <tbody>
                {estoqueAtual.map((p, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-4">{p.produto}</td>
                    <td className="py-2 px-4">{p.codigo}</td>
                    <td className="py-2 px-4 text-right">{fmtInt(p.estoque)}</td>
                    <td className="py-2 px-4 text-right">{fmtInt(p.estoque_minimo)}</td>
                    <td className="py-2 px-4 text-center">{p.alerta ? 'Baixo' : 'OK'}</td>
                  </tr>
                ))}
                {estoqueAtual.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-center text-gray-500">
                      Nenhum produto cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ranking' && (
        <>
          <HeaderPeriodo />
          <div className="bg-white p-6 rounded shadow">
            <h3 className="text-xl font-semibold mb-4">Ranking de Clientes</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th className="text-right">Qtde Compras</th>
                    <th className="text-right">Total Gasto</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingClientes.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.cliente}</td>
                      <td className="text-right">{fmtInt(item.qtd_compras)}</td>
                      <td className="text-right">{fmtBRL(item.total_gasto)}</td>
                    </tr>
                  ))}
                  {rankingClientes.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-2">Nenhum cliente encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
