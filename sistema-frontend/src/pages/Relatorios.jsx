// src/pages/Relatorios.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { FiBarChart2 } from 'react-icons/fi'
import { Page, Card } from '../components/ui'

const fmtBRL = (n) =>
  Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
const fmtInt = (n) => Intl.NumberFormat('pt-BR').format(Number(n || 0))
const toISO = (d) => d.toISOString().slice(0, 10)
const fmtDiaHora = (valor) => {
  if (!valor) return '--'

  const toDate = (raw) => {
    if (raw instanceof Date) return raw
    if (typeof raw === 'string') {
      const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
      const parsed = new Date(normalized)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    const parsed = new Date(raw)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const data = toDate(valor)
  if (!data) return String(valor)

  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(data)
  const partValue = (type) => parts.find((p) => p.type === type)?.value || ''
  const dia = partValue('day')
  const mes = partValue('month')
  const hora = partValue('hour')
  const minuto = partValue('minute')

  if (!dia || !mes || !hora || !minuto) {
    return formatter.format(data)
  }
  return `${dia}/${mes} ${hora}:${minuto}`
}

export default function Relatorios() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = useMemo(() => new URLSearchParams(location.search), [location.search])

  const initialTab = search.get('tab') || 'vendas-resumo'
  const [tab, setTab] = useState(initialTab)
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' })

  // estados dos dados
  const [resumoVendas, setResumoVendas] = useState({
    qtd_vendas: 0,
    total_vendas: 0,
    totais_por_forma: { dinheiro: 0, credito: 0, debito: 0, pix: 0, outros: 0 },
  })

  // vendas detalhadas (paginadas)
  const [vdItens, setVdItens] = useState([])
  const [vdPage, setVdPage] = useState(1)
  const [vdPerPage, setVdPerPage] = useState(25)
  const [vdTotal, setVdTotal] = useState(0)
  const [vdLoading, setVdLoading] = useState(false)

  // estoque atual (paginado)
  const [stkItens, setStkItens] = useState([])
  const [stkPage, setStkPage] = useState(1)
  const [stkPerPage, setStkPerPage] = useState(25)
  const [stkTotal, setStkTotal] = useState(0)
  const [stkLoading, setStkLoading] = useState(false)
  const [stkQ, setStkQ] = useState('')

  // outras abas
  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState([])
  const [rankingClientes, setRankingClientes] = useState([])

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [estoqueLoadedOnce, setEstoqueLoadedOnce] = useState(false)

  const carregarOutrosRelatorios = useCallback(async (p) => {
    const useP = p || periodo
    try {
      const [produtosRes, rankingRes] = await Promise.allSettled([
        api.get('/relatorios/produtos-mais-vendidos', { params: useP }),
        api.get('/relatorios/ranking-clientes', { params: useP }),
      ])
      if (produtosRes.status === 'fulfilled') {
        setProdutosMaisVendidos(Array.isArray(produtosRes.value.data) ? produtosRes.value.data : [])
      }
      if (rankingRes.status === 'fulfilled') {
        setRankingClientes(Array.isArray(rankingRes.value.data) ? rankingRes.value.data : [])
      }
    } catch (e) {
      console.error('Erro ao carregar relatorios adicionais:', e)
    }
  }, [periodo])

  useEffect(() => {
    const t = search.get('tab') || 'vendas-resumo'
    setTab(t)
  }, [search])

  // periodo padrao (mes corrente) + cargas iniciais
  useEffect(() => {
    const today = new Date()
    const first = new Date(today.getFullYear(), today.getMonth(), 1)
    const inicio = toISO(first)
    const fim = toISO(today)
    setPeriodo({ inicio, fim })
    ;(async () => {
      await carregarResumoVendas({ inicio, fim })
      await fetchVendasDetalhadas({ page: 1, perPage: vdPerPage, periodo: { inicio, fim } })
      await carregarOutrosRelatorios({ inicio, fim })
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // entrar na aba estoque  primeira carga
  useEffect(() => {
    if (tab === 'estoque' && !estoqueLoadedOnce) {
      fetchEstoque({ page: 1, perPage: stkPerPage, q: stkQ })
      setEstoqueLoadedOnce(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => {
    if (tab === 'produtos' || tab === 'ranking') {
      carregarOutrosRelatorios()
    }
  }, [tab, carregarOutrosRelatorios])

  // -------- carregadores --------
  const carregarResumoVendas = async (p) => {
    const useP = p || periodo
    try {
      const { data } = await api.get('/relatorios/vendas', { params: useP })
      setResumoVendas({
        qtd_vendas: Number(data?.qtd_vendas || 0),
        total_vendas: Number(data?.total_vendas || 0),
        totais_por_forma: {
          dinheiro: Number(data?.totais_por_forma?.dinheiro || 0),
          credito: Number(data?.totais_por_forma?.credito || 0),
          debito: Number(data?.totais_por_forma?.debito || 0),
          pix: Number(data?.totais_por_forma?.pix || 0),
          outros: Number(data?.totais_por_forma?.outros || 0),
        },
      })
    } catch (e) {
      console.error('Erro ao carregar resumo de vendas:', e)
      setErro('Nao foi possivel carregar resumo de vendas.')
    }
  }

  const fetchVendasDetalhadas = useCallback(async ({ page, perPage, periodo: per }) => {
    const useP = per || periodo
    setVdLoading(true)
    try {
      const resp = await api.get('/relatorios/vendas/detalhadas', {
        params: { ...useP, page, per_page: perPage }
      })
      const total = Number(resp.headers['x-total-count'] || 0)
      setVdItens(Array.isArray(resp.data) ? resp.data : [])
      setVdTotal(total)
      setVdPage(page)
      setVdPerPage(perPage)
    } catch (e) {
      console.error('Erro ao carregar vendas detalhadas:', e)
      setVdItens([])
      setVdTotal(0)
    } finally {
      setVdLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo.inicio, periodo.fim])

  const fetchEstoque = useCallback(async ({ page, perPage, q }) => {
    setStkLoading(true)
    try {
      const resp = await api.get('/relatorios/estoque-atual', {
        params: { page, per_page: perPage, q: q || undefined }
      })
      const total = Number(resp.headers['x-total-count'] || 0)
      setStkItens(Array.isArray(resp.data) ? resp.data : [])
      setStkTotal(total)
      setStkPage(page)
      setStkPerPage(perPage)
    } catch (e) {
      console.error('Erro ao carregar estoque atual:', e)
      setStkItens([])
      setStkTotal(0)
    } finally {
      setStkLoading(false)
    }
  }, [])

  const obterTodosProdutosEstoque = useCallback(async (q) => {
    const resultados = []
    let page = 1
    const perPage = 200

    while (true) {
      try {
        const resp = await api.get('/relatorios/estoque-atual', {
          params: { page, per_page: perPage, q: q || undefined },
        })
        const data = Array.isArray(resp.data) ? resp.data : []
        resultados.push(...data)

        const totalHeader = Number((resp.headers && resp.headers['x-total-count']) || 0)
        if (data.length < perPage || (totalHeader && resultados.length >= totalHeader)) {
          break
        }

        page += 1
      } catch (error) {
        throw error
      }
    }

    return resultados
  }, [])

  const aplicarPeriodo = async () => {
    setLoading(true)
    setErro('')
    try {
      await Promise.all([
        carregarResumoVendas(),
        fetchVendasDetalhadas({ page: 1, perPage: vdPerPage }),
        carregarOutrosRelatorios()
      ])
      if (tab === 'estoque') await fetchEstoque({ page: 1, perPage: stkPerPage, q: stkQ })
    } finally {
      setLoading(false)
    }
  }

  // -------- PDF --------
  const exportarPDF = async (options = {}) => {
    const { exportarTodosEstoque = false } = options
    const doc = new jsPDF()
    const titulos = {
      'vendas-resumo': 'Resumo de Vendas',
      'vendas-detalhadas': 'Vendas Detalhadas',
      produtos: 'Produtos Mais Vendidos',
      estoque: 'Estoque Atual',
      ranking: 'Ranking de Clientes'
    }
    const titulo = `Relatorio - ${titulos[tab]}`
    doc.setFontSize(14)
    doc.text(titulo, 14, 15)
    doc.setFontSize(10)
    doc.text(`Periodo: ${periodo.inicio || ''}  ${periodo.fim || ''}`, 14, 22)
    const startY = 28

    if (tab === 'vendas-resumo') {
      const f = resumoVendas.totais_por_forma || {}
      autoTable(doc, {
        startY,
        head: [['Metrica', 'Valor']],
        body: [
          ['Quantidade de Vendas', fmtInt(resumoVendas.qtd_vendas)],
          ['Total do Periodo', fmtBRL(resumoVendas.total_vendas)],
        ]
      })
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 6,
        head: [['Forma de Pagamento', 'Total']],
        body: [
          ['Dinheiro', fmtBRL(f.dinheiro || 0)],
          ['Credito', fmtBRL(f.credito || 0)],
          ['Debito', fmtBRL(f.debito || 0)],
          ['PIX', fmtBRL(f.pix || 0)],
          ['Outros', fmtBRL(f.outros || 0)],
        ]
      })
    } else if (tab === 'vendas-detalhadas') {
      autoTable(doc, {
        startY,
        head: [['Data', 'Cliente', 'Total', 'Pagamento(s)', 'Itens']],
        body: vdItens.map((v) => {
          const nomeCliente = (v.cliente && String(v.cliente).trim()) || 'Venda sem cliente'
          return [
          v.data_venda,
          nomeCliente,
          fmtBRL(v.total),
          (v.pagamentos?.length
            ? v.pagamentos.map(p => `${(p.forma || p.forma_pagamento || '').toUpperCase()} ${fmtBRL(p.valor)}`).join(' + ')
            : (v.formas?.join(', ').toUpperCase() || '')),
          v.itens?.map((i) => `${i.produto} (x${i.quantidade})`).join(', ')
        ]})
      })
    } else if (tab === 'produtos') {
      autoTable(doc, {
        startY,
        head: [['Produto', 'Codigo', 'Quantidade', 'Faturamento']],
        body: produtosMaisVendidos.map((item) => [
          item.produto,
          item.codigo ?? '',
          fmtInt(item.quantidade),
          fmtBRL(item.faturamento)
        ])
      })
    } else if (tab === 'estoque') {
      let dadosEstoque = Array.isArray(stkItens) ? stkItens : []
      if (exportarTodosEstoque) {
        try {
          dadosEstoque = await obterTodosProdutosEstoque(stkQ)
        } catch (error) {
          console.error('Erro ao preparar exportacao completa do estoque:', error)
          window.alert('Nao foi possivel carregar todos os produtos. Os dados exibidos na tela serao exportados.')
          dadosEstoque = Array.isArray(stkItens) ? stkItens : []
        }
      }

      autoTable(doc, {
        startY,
        head: [['Produto', 'Codigo', 'Estoque', 'Estoque Minimo', 'Alerta']],
        body: (dadosEstoque || []).map((p) => [
          p.produto,
          p.codigo ?? '',
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

  // -------- UI helpers --------
  const handlePeriodoChange = (e) => {
    setPeriodo((p) => ({ ...p, [e.target.name]: e.target.value }))
  }

  const pushTab = (t) => {
    const params = new URLSearchParams(location.search)
    params.set('tab', t)
    navigate(`/relatorios?${params.toString()}`, { replace: true })
  }

  // componentes pequenos
  const TopPager = ({ page, perPage, total, onPrev, onNext, onPerPage }) => {
    const showing = Math.min(perPage, Math.max(total - (page - 1) * perPage, 0))
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const canPrev = page > 1
    const canNext = page < totalPages
    const isEstoque = tab === 'estoque'
    return (
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>Mostrar</span>
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="border rounded px-2 py-1"
          >
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span>por pagina</span>
          <span className="ml-4">
            Pagina <b>{page}</b> mostrando <b>{showing}</b> de <b>{Math.max(totalPages, 1)}</b>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrev} disabled={!canPrev} className={`px-3 py-1 rounded border ${canPrev ? 'bg-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>Anterior</button>
          <button onClick={onNext} disabled={!canNext} className={`px-3 py-1 rounded border ${canNext ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>Proxima</button>
          <button
            onClick={() => exportarPDF()}
            className={`px-3 py-1 rounded bg-green-600 text-white ${isEstoque ? '' : 'ml-2'}`}
          >
            {isEstoque ? 'Exportar PDF (tela atual)' : 'PDF'}
          </button>
          {isEstoque && (
            <button
              onClick={() => exportarPDF({ exportarTodosEstoque: true })}
              className="px-3 py-1 rounded bg-green-700 text-white ml-2"
            >
              Exportar todos os produtos do sistema
            </button>
          )}
        </div>
      </div>
    )
  }


  const HeaderPeriodo = () => (
    <Card padding="p-6" className="shadow-md">
      <h3 className="text-xl font-semibold mb-4">Periodo</h3>
      <div className="flex flex-wrap items-end gap-4">
        <input type="date" name="inicio" value={periodo.inicio} onChange={handlePeriodoChange} className="shadow border rounded py-2 px-3" />
        <input type="date" name="fim" value={periodo.fim} onChange={handlePeriodoChange} className="shadow border rounded py-2 px-3" />
        <button onClick={aplicarPeriodo} disabled={loading} className="bg-blue-600 text-white px-4 py-2 rounded">
          {loading ? 'Atualizando...' : 'Aplicar periodo'}
        </button>
        <button onClick={exportarPDF} className="bg-green-600 text-white px-4 py-2 rounded">Exportar PDF</button>
      </div>
    </Card>
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
    <Page
      title="Relatorios"
      subtitle="Explore indicadores financeiros e operacionais."
      icon={<FiBarChart2 className="h-5 w-5" />}
    >
      <div className="space-y-4">
        <Tabs />

        {tab === 'vendas-resumo' && (
          <>
            <HeaderPeriodo />
            <Card padding="p-6" className="space-y-4">
              <h3 className="text-xl font-semibold">Resumo de Vendas</h3>
              <div>Total de vendas: {fmtInt(resumoVendas.qtd_vendas)}</div>
              <div>Valor total: {fmtBRL(resumoVendas.total_vendas)}</div>

              <div className="mt-4">
                <h4 className="font-semibold mb-2">Por forma de pagamento</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {[
                    ['Dinheiro', resumoVendas.totais_por_forma.dinheiro],
                    ['Credito', resumoVendas.totais_por_forma.credito],
                    ['Debito', resumoVendas.totais_por_forma.debito],
                    ['PIX', resumoVendas.totais_por_forma.pix],
                    ['Outros', resumoVendas.totais_por_forma.outros],
                  ].map(([label, val]) => (
                    <Card key={label} padding="p-3" className="flex items-center justify-between">
                      <span>{label}</span>
                      <strong>{fmtBRL(val)}</strong>
                    </Card>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}

        {tab === 'vendas-detalhadas' && (
          <>
            <HeaderPeriodo />
            <Card padding="p-6" className="space-y-4">
              <TopPager
                page={vdPage}
                perPage={vdPerPage}
                total={vdTotal}
                onPrev={() => vdPage > 1 && fetchVendasDetalhadas({ page: vdPage - 1, perPage: vdPerPage })}
                onNext={() => vdPage < Math.ceil(vdTotal / vdPerPage) && fetchVendasDetalhadas({ page: vdPage + 1, perPage: vdPerPage })}
                onPerPage={(n) => fetchVendasDetalhadas({ page: 1, perPage: n })}
              />
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-3">Data</th>
                      <th className="text-left py-2 px-3">Cliente</th>
                      <th className="text-right py-2 px-3">Total</th>
                      <th className="text-left py-2 px-3">Pagamento(s)</th>
                      <th className="text-left py-2 px-3">Itens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vdItens.map((v) => (
                      <tr key={v.id} className="border-top">
                        <td className="py-2 px-3">{fmtDiaHora(v.data_venda)}</td>
                        <td className="py-2 px-3">{(v.cliente && String(v.cliente).trim()) || 'Venda sem cliente'}</td>
                        <td className="py-2 px-3 text-right">{fmtBRL(v.total)}</td>
                        <td className="py-2 px-3">
                          {v.pagamentos?.length
                            ? v.pagamentos.map((p, ix) => (
                                <div key={ix}>
                                  {(p.forma || p.forma_pagamento || '').toUpperCase()}  {fmtBRL(p.valor)}
                                </div>
                              ))
                            : (v.formas?.join(', ').toUpperCase() || '')}
                        </td>
                        <td className="py-2 px-3">
                          {v.itens?.map((i, ix) => (
                            <div key={ix}>{i.produto} (x{i.quantidade})</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                    {!vdLoading && vdItens.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-gray-500">
                          Nenhuma venda encontrada neste periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {tab === 'produtos' && (
          <>
            <HeaderPeriodo />
            <Card padding="p-6" className="space-y-4">
              <h3 className="text-xl font-semibold">Produtos Mais Vendidos</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Codigo</th>
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
            </Card>
          </>
        )}

        {tab === 'estoque' && (
          <Card padding="p-6" className="space-y-4">
            <TopPager
              page={stkPage}
              perPage={stkPerPage}
              total={stkTotal}
              onPrev={() => stkPage > 1 && fetchEstoque({ page: stkPage - 1, perPage: stkPerPage, q: stkQ })}
              onNext={() => fetchEstoque({ page: stkPage + 1, perPage: stkPerPage, q: stkQ })}
              onPerPage={(n) => fetchEstoque({ page: 1, perPage: n, q: stkQ })}
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                className="border rounded px-3 py-2"
                placeholder="Buscar por nome/codigo..."
                value={stkQ}
                onChange={(e) => setStkQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchEstoque({ page: 1, perPage: stkPerPage, q: e.currentTarget.value })
                }}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 px-4">Produto</th>
                    <th className="py-2 px-4">Codigo</th>
                    <th className="py-2 px-4 text-right">Estoque</th>
                    <th className="py-2 px-4 text-right">Estoque Minimo</th>
                    <th className="py-2 px-4 text-center">Alerta</th>
                  </tr>
                </thead>
                <tbody>
                  {stkItens.map((p) => (
                    <tr key={p.produto_id}>
                      <td className="py-2 px-4">{p.produto}</td>
                      <td className="py-2 px-4">{p.codigo}</td>
                      <td className="py-2 px-4 text-right">{fmtInt(p.estoque)}</td>
                      <td className="py-2 px-4 text-right">{fmtInt(p.estoque_minimo)}</td>
                      <td className="py-2 px-4 text-center">{p.alerta ? 'Baixo' : 'OK'}</td>
                    </tr>
                  ))}
                  {!stkLoading && stkItens.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 px-4 text-center text-gray-500">
                        Nenhum produto encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'ranking' && (
          <>
            <HeaderPeriodo />
            <Card padding="p-6" className="space-y-4">
              <h3 className="text-xl font-semibold">Ranking de Clientes</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th className="text-right">Compras</th>
                      <th className="text-right">Total gasto</th>
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
            </Card>
          </>
        )}
      </div>
    </Page>
  );

}
