import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiArrowLeft, FiBox, FiChevronDown } from 'react-icons/fi'
import { Page, Card, EmptyState } from '../components/ui'
import { classNames } from '../utils/classNames'

function useDebounced(value, delay = 300) {
  const [currentValue, setCurrentValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setCurrentValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return currentValue
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

const parseTotalFromHeaders = (headers) => {
  if (!headers) return null
  const candidates = ['x-total-count', 'x-total', 'x-count', 'x-total-items', 'x-items-count']
  for (const key of candidates) {
    const value = headers[key]
    if (value != null && !Number.isNaN(Number(value))) return Number(value)
  }
  const contentRange = headers['content-range']
  if (contentRange && typeof contentRange === 'string' && contentRange.includes('/')) {
    const total = Number(contentRange.split('/').pop().trim())
    if (!Number.isNaN(total)) return total
  }
  return null
}

const fmtBRL = (value) =>
  typeof value === 'number' && !Number.isNaN(value)
    ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : '-'

const normalizeMoneyInput = (value) => {
  if (!value) return ''
  const normalized = value.replace(/[^0-9.,-]/g, '').replace(',', '.')
  return normalized
}

const parseMoneyToNumber = (value) => {
  if (!value) return null
  const normalized = value.replace(/[^0-9.,-]/g, '').replace(',', '.')
  const numeric = Number(normalized)
  return Number.isNaN(numeric) ? null : numeric
}

export default function Produtos() {
  const navigate = useNavigate()

  const [produtos, setProdutos] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounced(searchTerm, 400)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(null)
  const [categorias, setCategorias] = useState([])
  const [categoriasLoading, setCategoriasLoading] = useState(false)
  const [filters, setFilters] = useState({
    categoria: 'all',
    estoque: 'all',
    precoMin: '',
    precoMax: '',
    ativo: 'all',
  })

  const filtersKey = JSON.stringify(filters)


  useEffect(() => {
    const loadCategorias = async () => {
      try {
        setCategoriasLoading(true)
        const resp = await api.get('/categorias', { params: { per_page: 200 } })
        const lista = Array.isArray(resp?.data) ? resp.data : resp?.data?.items || []
        setCategorias(lista)
      } catch (error) {
        console.error('Erro ao carregar categorias', error)
      } finally {
        setCategoriasLoading(false)
      }
    }

    loadCategorias()
  }, [])
  const fetchTotalFallback = useCallback(async (token, term) => {
    if (!token) return null
    const query = (term || '').trim()
    const params = {
      q: query,
      search: query,
      term: query,
      nome: query,
    }
    const headers = { Authorization: `Bearer ${token}` }
    const endpoints = ['/produtos/count', '/produtos/total']

    for (const endpoint of endpoints) {
      try {
        const response = await api.get(endpoint, { params, headers })
        const data = response?.data
        const total =
          typeof data === 'number'
            ? data
            : typeof data?.total === 'number'
            ? data.total
            : typeof data?.count === 'number'
            ? data.count
            : null
        if (total != null) return total
      } catch (_) {
        // ignora fallback com erro e tenta o proximo endpoint
      }
    }

    return null
  }, [])

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(1)
  }

  const handlePriceChange = (field) => (event) => {
    const normalized = normalizeMoneyInput(event.target.value)
    handleFilterChange(field, normalized)
  }

  const handleSelectChange = (field) => (event) => {
    handleFilterChange(field, event.target.value)
  }

  const clearFilters = () => {
    setFilters({ categoria: 'all', estoque: 'all', precoMin: '', precoMax: '', ativo: 'all' })
    setPage(1)
  }

  const hasActiveFilters =
    filters.categoria !== 'all' ||
    filters.estoque !== 'all' ||
    filters.precoMin !== '' ||
    filters.precoMax !== '' ||
    filters.ativo !== 'all'

  const activeFiltersCount =
    (filters.categoria !== 'all' ? 1 : 0) +
    (filters.estoque !== 'all' ? 1 : 0) +
    (filters.precoMin !== '' ? 1 : 0) +
    (filters.precoMax !== '' ? 1 : 0) +
    (filters.ativo !== 'all' ? 1 : 0)

  const fetchProdutos = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login')
      return
    }

    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const limitPlusOne = pageSize + 1
      const searchValue = debouncedSearch.trim()

      const params = {
        offset,
        limit: limitPlusOne,
        q: searchValue || undefined,
        search: searchValue || undefined,
        term: searchValue || undefined,
        nome: searchValue || undefined,
      }

      if (filters.categoria !== 'all') {
        params.categoria_id = filters.categoria
      }

      if (filters.estoque !== 'all') {
        params.estoque_status = filters.estoque
      }

      const precoMinNumber = parseMoneyToNumber(filters.precoMin)
      if (precoMinNumber !== null) {
        params.preco_min = precoMinNumber
      }

      const precoMaxNumber = parseMoneyToNumber(filters.precoMax)
      if (precoMaxNumber !== null) {
        params.preco_max = precoMaxNumber
      }

      if (filters.ativo === 'ativos') {
        params.ativo = true
      } else if (filters.ativo === 'inativos') {
        params.ativo = false
      }

      const response = await api.get('/produtos', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })

      const rawData = response?.data ?? []
      const list = Array.isArray(rawData)
        ? rawData
        : Array.isArray(rawData?.items)
        ? rawData.items
        : []

      if (list.length > pageSize) {
        setHasMore(true)
        setProdutos(list.slice(0, pageSize))
      } else {
        setHasMore(false)
        setProdutos(list)
      }

      let total =
        parseTotalFromHeaders(response?.headers || {}) ??
        (typeof rawData?.total === 'number'
          ? rawData.total
          : typeof rawData?.count === 'number'
          ? rawData.count
          : null)

      if (total == null && !hasActiveFilters) {
        total = await fetchTotalFallback(token, searchValue)
      }

      if (total != null) {
        setTotalCount(total)
        const maxPages = Math.max(1, Math.ceil(total / pageSize))
        if (page > maxPages) {
          setPage(maxPages)
        }
      } else {
        setTotalCount(null)
      }

      if (list.length === 0 && total === 0) {
        setMessage({ tipo: 'info', texto: 'Nenhum produto encontrado para os filtros atuais.' })
      } else {
        setMessage(null)
      }
    } catch (error) {
      console.error('Erro ao carregar produtos', error)
      setProdutos([])
      setHasMore(false)
      setTotalCount(null)
      setMessage({ tipo: 'erro', texto: 'Erro ao carregar produtos.' })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, fetchTotalFallback, filtersKey, navigate, page, pageSize])


  useEffect(() => {
    fetchProdutos()
  }, [fetchProdutos])

  const handleDelete = useCallback(
    async (id) => {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      if (!window.confirm('Tem certeza que deseja excluir este produto?')) return

      try {
        await api.delete(`/produtos/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        setMessage({ tipo: 'sucesso', texto: 'Produto excluido com sucesso' })
        fetchProdutos()
      } catch (error) {
        console.error('Erro ao excluir produto:', error)
        setMessage({ tipo: 'erro', texto: 'Erro ao excluir produto' })
      }
    },
    [fetchProdutos, navigate]
  )

  const totalPages =
    typeof totalCount === 'number' ? Math.max(1, Math.ceil(totalCount / pageSize)) : null
  const currentPage = totalPages ? Math.min(page, totalPages) : page
  const rangeStart = produtos.length > 0 ? (currentPage - 1) * pageSize + 1 : 0
  const rangeEnd = produtos.length > 0 ? rangeStart + produtos.length - 1 : 0
  const disablePrev = currentPage <= 1
  const disableNext = totalPages ? currentPage >= totalPages : !hasMore

  const handlePrev = () => {
    if (!disablePrev) setPage((prev) => Math.max(1, prev - 1))
  }

  const handleNext = () => {
    if (!disableNext) setPage((prev) => prev + 1)
  }

  const handlePageSizeChange = (e) => {
    const newSize = Number(e.target.value) || 10
    setPageSize(newSize)
    setPage(1)
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-600 shadow-sm">
        <span className="font-medium text-slate-500">Mostrar</span>
        <div className="relative">
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="select h-9 w-32 appearance-none rounded-full bg-white px-4 pr-10 text-center font-semibold text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <FiChevronDown className="pointer-events-none absolute inset-y-0 right-3 my-auto h-4 w-4 text-slate-400" />
        </div>
        <span className="font-medium text-slate-500">por pagina</span>
      </div>
      <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary">
        <FiArrowLeft className="h-4 w-4" />
        Voltar
      </button>
      <button type="button" onClick={() => navigate('/produtos/novo')} className="btn-primary">
        <FiPlus className="h-4 w-4" />
        Novo produto
      </button>
    </div>
  )

  const messageTone =
    message?.tipo === 'erro'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : message?.tipo === 'info'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700'

  if (loading) {
    return (
      <Page
        title="Produtos"
        subtitle="Gerencie o catalogo de itens e acompanhe estoque e precos."
        icon={<FiBox className="h-5 w-5" />}
        actions={headerActions}
      >
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-blue-100 bg-white/80 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-blue-200" />
            <div className="h-4 w-32 animate-pulse rounded-full bg-blue-200" />
          </div>
        </div>
      </Page>
    )
  }

  return (
    <Page
      title="Produtos"
      subtitle="Gerencie o catalogo de itens e acompanhe estoque e precos."
      icon={<FiBox className="h-5 w-5" />}
      actions={headerActions}
    >
      {message ? (
        <div className={classNames('rounded-2xl border px-4 py-3 text-sm shadow-sm', messageTone)}>
          {message.texto}
        </div>
      ) : null}

      <Card className="p-4 sm:p-6">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar produtos por nome, categoria, fornecedor, marca ou codigo"
            className="input pl-12"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value)
              setPage(1)
            }}
          />
        </div>
      </Card>

      {produtos.length === 0 ? (
        <EmptyState
          title={searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
          description={
            searchTerm
              ? 'Ajuste os filtros ou tente buscar por outro termo.'
              : 'Cadastre o primeiro produto para iniciar o controle de estoque.'
          }
          actions={
            searchTerm ? (
              <button type="button" onClick={() => setSearchTerm('')} className="btn-secondary">
                Limpar busca
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/produtos/novo')} className="btn-primary">
                <FiPlus className="h-4 w-4" />
                Cadastrar produto
              </button>
            )
          }
        />
      ) : (
        <div className="table-shell">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Produto</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fornecedor</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Precos</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Estoque</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Datas</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {produtos.map((produto) => (
                  <tr key={produto.id} className="transition hover:bg-slate-50 focus-within:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                          {(produto.nome?.charAt(0) || '?').toUpperCase()}
                        </div>
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-900">{produto.nome || '-'}</div>
                          <div className="text-xs uppercase tracking-wide text-slate-400 flex flex-wrap gap-2">
                            <span>Codigo: {produto.codigo_produto || '-'}</span>
                            <span>Categoria: {produto?.categoria?.nome || '-'}</span>
                            <span>Marca: {produto.marca || '-'}</span>
                            <span>Local: {produto.localizacao || '-'}</span>
                            <span>Barras: {produto.codigo_barras || '-'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {produto?.fornecedor?.nome || produto?.fornecedor_obj?.nome || produto?.fornecedor || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="space-y-1">
                        <div>Custo: {fmtBRL(Number(produto.custo))}</div>
                        <div>Custo médio: {fmtBRL(Number(produto.custo_medio ?? produto.custo))}</div>
                        <div>Venda: <span className="font-semibold text-slate-900">{fmtBRL(Number(produto.preco_venda))}</span></div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={classNames(
                          'badge',
                          (produto.estoque ?? 0) <= 0
                            ? 'bg-rose-100 text-rose-700'
                            : (produto.estoque ?? 0) < 10
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        {produto.estoque ?? 0} {produto?.unidade_medida?.sigla || 'UN'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="space-y-1">
                        <div>Cadastrado: {produto.criado_em ? new Date(produto.criado_em).toLocaleDateString('pt-BR') : '-'}</div>
                        <div>Atualizado: {produto.atualizado_em ? new Date(produto.atualizado_em).toLocaleDateString('pt-BR') : '-'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/produtos/editar/${produto.id}`)}
                          className="btn-ghost h-9 w-9 rounded-full p-0 text-blue-600 hover:text-blue-700"
                          title="Editar"
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(produto.id)}
                          className="btn-ghost h-9 w-9 rounded-full p-0 text-rose-600 hover:text-rose-700"
                          title="Excluir"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Card className="flex flex-col gap-3 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <div>
          Pagina <span className="font-semibold text-slate-900">{currentPage}</span>{' '}
          {produtos.length > 0 && typeof totalCount === 'number' ? (
            <>
              mostrando <span className="font-semibold text-slate-900">{rangeStart}-{rangeEnd}</span>{' '}
              de <span className="font-semibold text-slate-900">{totalCount}</span> produtos
            </>
          ) : (
            <>mostrando <span className="font-semibold text-slate-900">{produtos.length}</span> produtos</>
          )}{' '}
          ({pageSize} por pagina) |{' '}
          <span className="font-semibold text-slate-900">
            Total geral: {typeof totalCount === 'number' ? totalCount : '--'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrev}
            disabled={disablePrev}
            className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            Anterior
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={disableNext}
            className="btn-primary disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            Proxima
          </button>
        </div>
      </Card>
    </Page>
  )
}
