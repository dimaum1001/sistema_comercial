// src/pages/Relatorios.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../services/api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import {
  FiAward,
  FiBarChart2,
  FiCalendar,
  FiDownloadCloud,
  FiLayers,
  FiList,
  FiRefreshCw,
  FiShoppingBag,
  FiTrendingUp,
} from 'react-icons/fi'
import { Page, Card } from '../components/ui'

const fmtBRL = (n) => Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n || 0))
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

const TAB_CONFIG = [
  { key: 'vendas-resumo', label: 'Visao Geral', description: 'Painel executivo', icon: FiTrendingUp },
  { key: 'vendas-detalhadas', label: 'Vendas Detalhadas', description: 'Fluxo operacional', icon: FiList },
  { key: 'produtos', label: 'Produtos Campeoes', description: 'Itens de maior giro', icon: FiShoppingBag },
  { key: 'estoque', label: 'Estoque Atual', description: 'Cobertura e alertas', icon: FiLayers },
  { key: 'ranking', label: 'Ranking de Clientes', description: 'Valor por relacionamento', icon: FiAward },
]

const FORMA_LABELS = { dinheiro: 'Dinheiro', credito: 'Credito', debito: 'Debito', pix: 'PIX', outros: 'Outros' }
const FORMA_COLORS = {
  dinheiro: 'bg-emerald-500',
  credito: 'bg-indigo-500',
  debito: 'bg-blue-500',
  pix: 'bg-slate-700',
  outros: 'bg-gray-400',
}

const PERIOD_SHORTCUTS = [
  { key: '7d', label: 'Ultimos 7 dias' },
  { key: '30d', label: 'Ultimos 30 dias' },
  { key: 'mes', label: 'Mes atual' },
  { key: 'ytd', label: 'Ano atual' },
]
export default function Relatorios() {
  const location = useLocation()
  const navigate = useNavigate()
  const search = useMemo(() => new URLSearchParams(location.search), [location.search])

  const initialTab = search.get('tab') || 'vendas-resumo'
  const [tab, setTab] = useState(initialTab)
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' })
  const [activePeriodShortcut, setActivePeriodShortcut] = useState('')

  const [resumoVendas, setResumoVendas] = useState({
    qtd_vendas: 0,
    total_vendas: 0,
    totais_por_forma: { dinheiro: 0, credito: 0, debito: 0, pix: 0, outros: 0 },
  })

  const [vdItens, setVdItens] = useState([])
  const [vdPage, setVdPage] = useState(1)
  const [vdPerPage, setVdPerPage] = useState(25)
  const [vdTotal, setVdTotal] = useState(0)
  const [vdLoading, setVdLoading] = useState(false)

  const [stkItens, setStkItens] = useState([])
  const [stkPage, setStkPage] = useState(1)
  const [stkPerPage, setStkPerPage] = useState(25)
  const [stkTotal, setStkTotal] = useState(0)
  const [stkLoading, setStkLoading] = useState(false)
  const [stkQ, setStkQ] = useState('')

  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState([])
  const [rankingClientes, setRankingClientes] = useState([])

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [estoqueLoadedOnce, setEstoqueLoadedOnce] = useState(false)

  const carregarOutrosRelatorios = useCallback(
    async (p) => {
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
    },
    [periodo],
  )

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
    setActivePeriodShortcut('mes')
    ;(async () => {
      await carregarResumoVendas({ inicio, fim })
      await fetchVendasDetalhadas({ page: 1, perPage: vdPerPage, periodo: { inicio, fim } })
      await carregarOutrosRelatorios({ inicio, fim })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  const fetchVendasDetalhadas = useCallback(
    async ({ page, perPage, periodo: per }) => {
      const useP = per || periodo
      setVdLoading(true)
      try {
        const resp = await api.get('/relatorios/vendas/detalhadas', {
          params: { ...useP, page, per_page: perPage },
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
    },
    [periodo.inicio, periodo.fim],
  )

  const fetchEstoque = useCallback(async ({ page, perPage, q }) => {
    setStkLoading(true)
    try {
      const resp = await api.get('/relatorios/estoque-atual', {
        params: { page, per_page: perPage, q: q || undefined },
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

  const aplicarPeriodo = async (overridePeriodo) => {
    const periodoAlvo = overridePeriodo || periodo
    setLoading(true)
    setErro('')
    try {
      await Promise.all([
        carregarResumoVendas(periodoAlvo),
        fetchVendasDetalhadas({ page: 1, perPage: vdPerPage, periodo: periodoAlvo }),
        carregarOutrosRelatorios(periodoAlvo),
      ])
      if (tab === 'estoque') {
        await fetchEstoque({ page: 1, perPage: stkPerPage, q: stkQ })
      }
    } finally {
      setLoading(false)
    }
  }
  const exportarPDF = async (options = {}) => {
    const { exportarTodosEstoque = false } = options
    const doc = new jsPDF()
    const metaTab = TAB_CONFIG.find((item) => item.key === tab)
    const titulo = `Relatorio - ${metaTab?.label || 'Resumo'}`
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
        ],
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
        ],
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
            v.pagamentos?.length
              ? v.pagamentos
                  .map((p) => `${(p.forma || p.forma_pagamento || '').toUpperCase()} ${fmtBRL(p.valor)}`)
                  .join(' + ')
              : v.formas?.join(', ').toUpperCase() || '',
            v.itens?.map((i) => `${i.produto} (x${i.quantidade})`).join(', '),
          ]
        }),
      })
    } else if (tab === 'produtos') {
      autoTable(doc, {
        startY,
        head: [['Produto', 'Codigo', 'Quantidade', 'Faturamento']],
        body: produtosMaisVendidos.map((item) => [
          item.produto,
          item.codigo ?? '',
          fmtInt(item.quantidade),
          fmtBRL(item.faturamento),
        ]),
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
          p.alerta ? 'Baixo' : 'OK',
        ]),
      })
    } else if (tab === 'ranking') {
      autoTable(doc, {
        startY,
        head: [['Cliente', 'Qtde Compras', 'Total Gasto']],
        body: rankingClientes.map((item) => [item.cliente, fmtInt(item.qtd_compras), fmtBRL(item.total_gasto)]),
      })
    }

    doc.save(`relatorio-${tab}.pdf`)
  }

  const handlePeriodoChange = (e) => {
    const { name, value } = e.target
    setActivePeriodShortcut('')
    setPeriodo((p) => ({ ...p, [name]: value }))
  }

  const pushTab = (t) => {
    setTab(t)
    const params = new URLSearchParams(location.search)
    params.set('tab', t)
    navigate(`/relatorios?${params.toString()}`, { replace: true })
  }

  const handleShortcutPeriodo = (shortcutKey) => {
    const agora = new Date()
    const fim = toISO(agora)
    let inicioDate = new Date(agora)

    if (shortcutKey === '7d') {
      inicioDate.setDate(agora.getDate() - 6)
    } else if (shortcutKey === '30d') {
      inicioDate.setDate(agora.getDate() - 29)
    } else if (shortcutKey === 'mes') {
      inicioDate = new Date(agora.getFullYear(), agora.getMonth(), 1)
    } else if (shortcutKey === 'ytd') {
      inicioDate = new Date(agora.getFullYear(), 0, 1)
    }

    const novoPeriodo = { inicio: toISO(inicioDate), fim }
    setPeriodo(novoPeriodo)
    setActivePeriodShortcut(shortcutKey)
    aplicarPeriodo(novoPeriodo)
  }
  const formasList = useMemo(() => {
    const entries = Object.entries(resumoVendas?.totais_por_forma || {})
      .map(([key, raw]) => ({
        key,
        label: FORMA_LABELS[key] || key,
        value: Number(raw || 0),
      }))
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)

    const total = entries.reduce((sum, entry) => sum + entry.value, 0)
    return entries.map((entry) => ({
      ...entry,
      percent: total ? Math.round((entry.value / total) * 100) : 0,
      colorClass: FORMA_COLORS[entry.key] || 'bg-gray-400',
    }))
  }, [resumoVendas])

  const totalReceita = Number(resumoVendas.total_vendas || 0)
  const totalPedidos = Number(resumoVendas.qtd_vendas || 0)
  const ticketMedio = totalPedidos > 0 ? totalReceita / totalPedidos : 0
  const formaDestaque = formasList[0]

  const topProduto = useMemo(
    () => (Array.isArray(produtosMaisVendidos) && produtosMaisVendidos.length ? produtosMaisVendidos[0] : null),
    [produtosMaisVendidos],
  )
  const topCliente = useMemo(
    () => (Array.isArray(rankingClientes) && rankingClientes.length ? rankingClientes[0] : null),
    [rankingClientes],
  )

  const produtosTotais = useMemo(() => {
    if (!Array.isArray(produtosMaisVendidos) || !produtosMaisVendidos.length) {
      return { faturamento: 0, quantidade: 0 }
    }
    return {
      faturamento: produtosMaisVendidos.reduce((sum, item) => sum + Number(item.faturamento || 0), 0),
      quantidade: produtosMaisVendidos.reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
    }
  }, [produtosMaisVendidos])

  const clientesTotais = useMemo(() => {
    if (!Array.isArray(rankingClientes) || !rankingClientes.length) {
      return { gasto: 0 }
    }
    return {
      gasto: rankingClientes.reduce((sum, item) => sum + Number(item.total_gasto || 0), 0),
    }
  }, [rankingClientes])
  const MetricHighlight = ({ label, value, helper, accent }) => (
    <div className="rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {helper && <p className="mt-1 text-sm text-gray-500">{helper}</p>}
      {accent && <span className="mt-3 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{accent}</span>}
    </div>
  )

  const Tabs = () => (
    <div className="flex flex-wrap gap-3">
      {TAB_CONFIG.map((item) => {
        const Icon = item.icon
        const active = tab === item.key
        return (
          <button
            key={item.key}
            onClick={() => pushTab(item.key)}
            className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition shadow-sm sm:min-w-[200px] ${
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300'
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="h-4 w-4" />
              {item.label}
            </span>
            <span className={`text-xs ${active ? 'text-blue-100' : 'text-gray-500'}`}>{item.description}</span>
          </button>
        )
      })}
    </div>
  )
  const HeaderPeriodo = () => (
    <Card padding="p-6" className="shadow-lg border border-gray-100 bg-gradient-to-br from-white to-slate-50">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <FiCalendar className="h-4 w-4" />
              Periodo analisado
            </p>
            <p className="text-xs text-gray-500">Combine datas personalizadas com atalhos de um toque.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => aplicarPeriodo()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-blue-700 disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Atualizando...' : 'Aplicar periodo'}
            </button>
            <button
              onClick={() => exportarPDF()}
              className="inline-flex items-center gap-2 rounded-xl border border-green-600 bg-white px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-50"
            >
              <FiDownloadCloud className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-wide text-gray-500">Periodo personalizado</span>
            <div className="flex flex-wrap gap-3">
              <label className="flex flex-col text-sm text-gray-600">
                <span className="text-xs uppercase tracking-wide text-gray-500">Inicio</span>
                <input
                  type="date"
                  name="inicio"
                  value={periodo.inicio}
                  onChange={handlePeriodoChange}
                  className="rounded-xl border border-gray-200 px-3 py-2 shadow-sm"
                />
              </label>
              <label className="flex flex-col text-sm text-gray-600">
                <span className="text-xs uppercase tracking-wide text-gray-500">Fim</span>
                <input
                  type="date"
                  name="fim"
                  value={periodo.fim}
                  onChange={handlePeriodoChange}
                  className="rounded-xl border border-gray-200 px-3 py-2 shadow-sm"
                />
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-gray-500">Atalhos executivos</span>
              <span className="text-[11px] text-gray-400">Selecione um periodo pre-configurado</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PERIOD_SHORTCUTS.map((shortcut) => {
                const active = activePeriodShortcut === shortcut.key
                return (
                  <button
                    key={shortcut.key}
                    type="button"
                    onClick={() => handleShortcutPeriodo(shortcut.key)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-blue-400'
                    }`}
                  >
                    {shortcut.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )

  const TopPager = ({ page, perPage, total, onPrev, onNext, onPerPage }) => {
    const totalPages = Math.max(1, Math.ceil(total / perPage))
    const canPrev = page > 1
    const canNext = page < totalPages
    const start = total === 0 ? 0 : (page - 1) * perPage + 1
    const end = total === 0 ? 0 : Math.min(page * perPage, total)
    const isEstoque = tab === 'estoque'

    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-gray-800">
              {total ? `Exibindo ${fmtInt(start)}-${fmtInt(end)} de ${fmtInt(total)}` : 'Sem registros neste periodo'}
            </span>
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1">
              <span>Itens por pagina</span>
              <select
                value={perPage}
                onChange={(e) => onPerPage(Number(e.target.value))}
                className="rounded-md border border-gray-200 px-2 py-1"
              >
                {[10, 25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onPrev}
              disabled={!canPrev}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-600 transition hover:border-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={onNext}
              disabled={!canNext}
              className="rounded-full border border-blue-600 bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              Proxima
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportarPDF()}
            className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-blue-400"
          >
            Exportar PDF
          </button>
          {isEstoque && (
            <button
              onClick={() => exportarPDF({ exportarTodosEstoque: true })}
              className="rounded-full border border-green-600 bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Exportar todos os produtos
            </button>
          )}
        </div>
      </div>
    )
  }
  return (
    <Page
      title="Relatorios"
      subtitle="Transforme dados de vendas e estoque em decisoes executivas com um painel claro e acionavel."
      icon={<FiBarChart2 className="h-5 w-5" />}
    >
      <div className="space-y-5">
        <Tabs />

        {erro && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
        )}

        {tab === 'vendas-resumo' && (
          <>
            <HeaderPeriodo />
            <Card padding="p-6" className="space-y-6 border border-gray-100 shadow-lg">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold text-gray-900">Resumo executivo</h3>
                <p className="text-sm text-gray-500">
                  Olhe rapidamente para receita, volume e preferencias de pagamento do periodo selecionado.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricHighlight label="Receita no periodo" value={fmtBRL(totalReceita)} helper="Vendas liquidas registradas" />
                <MetricHighlight label="Quantidade de vendas" value={fmtInt(totalPedidos)} helper="Pedidos confirmados" />
                <MetricHighlight label="Ticket medio" value={fmtBRL(ticketMedio)} helper="Receita / numero de vendas" />
                <MetricHighlight
                  label="Forma preferida"
                  value={formaDestaque ? formaDestaque.label : '--'}
                  helper={formaDestaque ? fmtBRL(formaDestaque.value) : 'Aguardando dados'}
                  accent={formaDestaque ? `${formaDestaque.percent}% do faturamento` : undefined}
                />
              </div>
            </Card>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card padding="p-6" className="space-y-4 border border-gray-100 shadow-sm xl:col-span-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Mix por forma de pagamento</p>
                    <p className="text-xs text-gray-500">Analise onde esta o caixa e adapte a estrategia comercial.</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {formasList.length === 0 && <p className="text-sm text-gray-500">Ainda nao ha dados suficientes para o periodo.</p>}
                  {formasList.map((forma) => (
                    <div key={forma.key}>
                      <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                        <span>{forma.label}</span>
                        <span>
                          {fmtBRL(forma.value)} ({forma.percent}%)
                        </span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${forma.colorClass}`} style={{ width: `${forma.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <div className="grid gap-4">
                <Card padding="p-5" className="space-y-2 border border-gray-100 shadow-sm">
                  <p className="text-sm font-semibold text-gray-800">Produto destaque</p>
                  {topProduto ? (
                    <>
                      <p className="text-lg font-semibold text-gray-900">{topProduto.produto}</p>
                      <p className="text-sm text-gray-500">Codigo {topProduto.codigo || 's/ codigo'}</p>
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                        <span>{fmtInt(topProduto.quantidade)} unidades</span>
                        <span>{fmtBRL(topProduto.faturamento)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Sem dados suficientes para o periodo.</p>
                  )}
                </Card>
                <Card padding="p-5" className="space-y-2 border border-gray-100 shadow-sm">
                  <p className="text-sm font-semibold text-gray-800">Cliente destaque</p>
                  {topCliente ? (
                    <>
                      <p className="text-lg font-semibold text-gray-900">{topCliente.cliente}</p>
                      <div className="flex items-center justify-between text-sm font-medium text-gray-700">
                        <span>{fmtInt(topCliente.qtd_compras)} compras</span>
                        <span>{fmtBRL(topCliente.total_gasto)}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Sem movimentacoes no periodo selecionado.</p>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
        {tab === 'vendas-detalhadas' && (
          <>
            <HeaderPeriodo />
            <Card padding="p-6" className="space-y-5 border border-gray-100 shadow-lg">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold text-gray-900">Linha do tempo de vendas</h3>
                <p className="text-sm text-gray-500">Visualize cada venda com cliente, formas de pagamento e itens emitidos.</p>
              </div>
              <TopPager
                page={vdPage}
                perPage={vdPerPage}
                total={vdTotal}
                onPrev={() => vdPage > 1 && fetchVendasDetalhadas({ page: vdPage - 1, perPage: vdPerPage })}
                onNext={() =>
                  vdPage < Math.ceil((vdTotal || 0) / vdPerPage) && fetchVendasDetalhadas({ page: vdPage + 1, perPage: vdPerPage })
                }
                onPerPage={(n) => fetchVendasDetalhadas({ page: 1, perPage: n })}
              />
              <div className="overflow-x-auto">
                <table className="min-w-[960px] text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-3 px-4 text-left">Data</th>
                      <th className="py-3 px-4 text-left">Cliente</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4 text-left">Pagamento(s)</th>
                      <th className="py-3 px-4 text-left">Itens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vdItens.map((v) => (
                      <tr key={v.id} className="border-b border-gray-100 text-gray-700">
                        <td className="py-3 px-4 font-semibold">{fmtDiaHora(v.data_venda)}</td>
                        <td className="py-3 px-4">{(v.cliente && String(v.cliente).trim()) || 'Venda sem cliente'}</td>
                        <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmtBRL(v.total)}</td>
                        <td className="py-3 px-4">
                          {v.pagamentos?.length
                            ? v.pagamentos.map((p, ix) => (
                                <div key={`${v.id}-pag-${ix}`} className="text-xs font-semibold text-gray-600">
                                  {(p.forma || p.forma_pagamento || '').toUpperCase()} � {fmtBRL(p.valor)}
                                </div>
                              ))
                            : v.formas?.length
                              ? v.formas.map((forma, ix) => (
                                  <span key={`${v.id}-forma-${ix}`} className="mr-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                    {forma.toUpperCase()}
                                  </span>
                                ))
                              : '--'}
                        </td>
                        <td className="py-3 px-4 text-xs text-gray-600">
                          {v.itens?.map((i, ix) => (
                            <div key={`${v.id}-item-${ix}`} className="flex justify-between gap-2">
                              <span className="font-medium text-gray-700">{i.produto}</span>
                              <span>x{i.quantidade}</span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                    {vdLoading && (
                      <tr>
                        <td colSpan={5} className="py-5 text-center text-sm text-gray-500">
                          Carregando vendas detalhadas...
                        </td>
                      </tr>
                    )}
                    {!vdLoading && vdItens.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-5 text-center text-sm text-gray-500">
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
            <Card padding="p-6" className="space-y-4 border border-gray-100 shadow-lg">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold text-gray-900">Produtos mais vendidos</h3>
                <p className="text-sm text-gray-500">
                  Uma lista enxuta para entender quem puxa faturamento e onde ha oportunidade de cross-selling.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-3 px-4 text-left">#</th>
                      <th className="py-3 px-4 text-left">Produto</th>
                      <th className="py-3 px-4 text-left">Codigo</th>
                      <th className="py-3 px-4 text-right">Quantidade</th>
                      <th className="py-3 px-4 text-right">Faturamento</th>
                      <th className="py-3 px-4 text-right">Participacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {produtosMaisVendidos.map((item, idx) => {
                      const share = produtosTotais.faturamento
                        ? Math.round((Number(item.faturamento || 0) / produtosTotais.faturamento) * 100)
                        : 0
                      return (
                        <tr key={`${item.codigo || item.produto}-${idx}`} className="border-b border-gray-100 text-gray-700">
                          <td className="py-3 px-4 font-semibold text-gray-900">{idx + 1}</td>
                          <td className="py-3 px-4 font-semibold">{item.produto}</td>
                          <td className="py-3 px-4">{item.codigo || '--'}</td>
                          <td className="py-3 px-4 text-right font-semibold">{fmtInt(item.quantidade)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmtBRL(item.faturamento)}</td>
                          <td className="py-3 px-4 text-right text-xs text-gray-600">{share ? `${share}%` : '--'}</td>
                        </tr>
                      )
                    })}
                    {produtosMaisVendidos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-5 text-center text-sm text-gray-500">
                          Nenhum item encontrado para o periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
        {tab === 'estoque' && (
          <Card padding="p-6" className="space-y-4 border border-gray-100 shadow-lg">
            <div className="flex flex-col gap-1">
              <h3 className="text-xl font-semibold text-gray-900">Saude do estoque</h3>
              <p className="text-sm text-gray-500">Filtre por produto ou codigo e monitore alertas de minimo rapidamente.</p>
            </div>
            <TopPager
              page={stkPage}
              perPage={stkPerPage}
              total={stkTotal}
              onPrev={() => stkPage > 1 && fetchEstoque({ page: stkPage - 1, perPage: stkPerPage, q: stkQ })}
              onNext={() => fetchEstoque({ page: stkPage + 1, perPage: stkPerPage, q: stkQ })}
              onPerPage={(n) => fetchEstoque({ page: 1, perPage: n, q: stkQ })}
            />
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">Filtro rapido</p>
                <p className="text-xs text-gray-500">Busque por nome ou codigo interno.</p>
              </div>
              <input
                className="flex-1 rounded-xl border border-gray-200 px-3 py-2 shadow-sm"
                placeholder="Digite nome ou codigo..."
                value={stkQ}
                onChange={(e) => setStkQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchEstoque({ page: 1, perPage: stkPerPage, q: e.currentTarget.value })
                }}
              />
              <button
                onClick={() => fetchEstoque({ page: 1, perPage: stkPerPage, q: stkQ })}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                Buscar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[720px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr className="text-left">
                    <th className="py-3 px-4">Produto</th>
                    <th className="py-3 px-4">Codigo</th>
                    <th className="py-3 px-4 text-right">Estoque</th>
                    <th className="py-3 px-4 text-right">Estoque minimo</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stkItens.map((p) => (
                    <tr key={p.produto_id} className="border-b border-gray-100 text-gray-700">
                      <td className="py-3 px-4 font-semibold">{p.produto}</td>
                      <td className="py-3 px-4">{p.codigo}</td>
                      <td className="py-3 px-4 text-right font-semibold">{fmtInt(p.estoque)}</td>
                      <td className="py-3 px-4 text-right">{fmtInt(p.estoque_minimo)}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            p.alerta
                              ? 'border border-red-200 bg-red-50 text-red-700'
                              : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {p.alerta ? 'Abaixo do minimo' : 'Estavel'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {stkLoading && (
                    <tr>
                      <td colSpan={5} className="py-5 text-center text-sm text-gray-500">
                        Carregando estoque...
                      </td>
                    </tr>
                  )}
                  {!stkLoading && stkItens.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-5 text-center text-sm text-gray-500">
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
            <Card padding="p-6" className="space-y-4 border border-gray-100 shadow-lg">
              <div className="flex flex-col gap-1">
                <h3 className="text-xl font-semibold text-gray-900">Valor de clientes</h3>
                <p className="text-sm text-gray-500">
                  Entenda quem sustenta a receita e como priorizar contatos e campanhas de fidelidade.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[720px] text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="py-3 px-4 text-left">#</th>
                      <th className="py-3 px-4 text-left">Cliente</th>
                      <th className="py-3 px-4 text-right">Compras</th>
                      <th className="py-3 px-4 text-right">Ticket medio</th>
                      <th className="py-3 px-4 text-right">Total gasto</th>
                      <th className="py-3 px-4 text-right">Participacao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingClientes.map((item, idx) => {
                      const ticket = item.qtd_compras ? Number(item.total_gasto || 0) / item.qtd_compras : 0
                      const share = clientesTotais.gasto
                        ? Math.round((Number(item.total_gasto || 0) / clientesTotais.gasto) * 100)
                        : 0
                      return (
                        <tr key={`${item.cliente}-${idx}`} className="border-b border-gray-100 text-gray-700">
                          <td className="py-3 px-4 font-semibold text-gray-900">{idx + 1}</td>
                          <td className="py-3 px-4 font-semibold">{item.cliente}</td>
                          <td className="py-3 px-4 text-right font-semibold">{fmtInt(item.qtd_compras)}</td>
                          <td className="py-3 px-4 text-right">{fmtBRL(ticket)}</td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{fmtBRL(item.total_gasto)}</td>
                          <td className="py-3 px-4 text-right text-xs text-gray-600">{share ? `${share}%` : '--'}</td>
                        </tr>
                      )
                    })}
                    {rankingClientes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-5 text-center text-sm text-gray-500">
                          Nenhum cliente encontrado.
                        </td>
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
  )
}

