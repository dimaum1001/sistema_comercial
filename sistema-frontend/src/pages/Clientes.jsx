import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { FiUserPlus, FiArrowLeft, FiEdit, FiTrash2, FiSearch, FiUsers } from 'react-icons/fi'
import { PageHeader, EmptyState } from '../components/ui'

function useDebounced(value, delay = 300) {
  const [currentValue, setCurrentValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setCurrentValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return currentValue
}

const TOTAL_HEADER_KEYS = ['x-total-count', 'x-total', 'x-count', 'x-total-items', 'x-items-count']

function parseTotalFromHeaders(headers = {}) {
  for (const key of TOTAL_HEADER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(headers, key)) {
      const value = headers[key]
      const numero = Number(value)
      if (!Number.isNaN(numero)) {
        return numero
      }
    }
  }
  const contentRange = headers['content-range']
  if (typeof contentRange === 'string' && contentRange.includes('/')) {
    const total = Number(contentRange.split('/').pop())
    if (!Number.isNaN(total)) {
      return total
    }
  }
  return null
}

function maskCpfCnpj(valor) {
  if (!valor) return 'Nao informado'
  const str = String(valor)
  if (str.includes('*')) return str
  const digits = str.replace(/[^0-9]/g, '')
  if (digits.length === 11) {
    return `***.***.***-${digits.slice(-2)}`
  }
  if (digits.length === 14) {
    return `**.***.***/****-${digits.slice(-2)}`
  }
  if (digits.length > 4) {
    const masked = '*'.repeat(digits.length - 4)
    return `${masked}${digits.slice(-4)}`
  }
  return '*'.repeat(Math.max(0, digits.length - 1)) + digits.slice(-1)
}

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounced(searchTerm, 400)

  // paginacao
  const [pageSize, setPageSize] = useState(10) // 10, 25, 50, 100
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // total geral (tabela inteira no banco)
  const [totalCount, setTotalCount] = useState(null)

  const navigate = useNavigate()

  const fetchTotalFallback = useCallback(async (query) => {
    try {
      const term = (query || '').trim()
      const params = term
        ? { q: term, search: term, term: term, nome: term }
        : {}
      const response = await api.get('/clientes/count', { params })
      const data = response?.data
      const total =
        typeof data === 'number'
          ? data
          : typeof data?.total === 'number'
          ? data.total
          : typeof data?.count === 'number'
          ? data.count
          : null
      if (total != null) {
        setTotalCount(total)
      }
    } catch (error) {
      console.error('Erro ao obter total de clientes (fallback):', error)
      setTotalCount(null)
    }
  }, [])

  const fetchClientes = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login')
      return
    }

    setLoading(true)
    try {
      const skip = (page - 1) * pageSize
      const limitPlusOne = pageSize + 1
      const searchValue = debouncedSearch.trim()

      const params = {
        skip,
        limit: limitPlusOne,
      }

      if (searchValue) {
        params.q = searchValue
        params.search = searchValue
        params.term = searchValue
        params.nome = searchValue
      }

      const response = await api.get('/clientes', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })

      const data = Array.isArray(response.data) ? response.data : []
      if (data.length > pageSize) {
        setHasMore(true)
        setClientes(data.slice(0, pageSize))
      } else {
        setHasMore(false)
        setClientes(data)
      }

      const totalFromHeaders = parseTotalFromHeaders(response.headers || {})
      if (totalFromHeaders != null) {
        setTotalCount(totalFromHeaders)
      } else {
        await fetchTotalFallback(searchValue)
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err)
      setHasMore(false)
      setClientes([])
      setTotalCount(null)
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, fetchTotalFallback, navigate, page, pageSize])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    setPage((prev) => (prev === 1 ? prev : 1))
  }, [debouncedSearch])

  const filteredClientes = clientes.filter((cliente) => {
    const nome = (cliente.nome || '').toLowerCase()
    const cpf = (cliente.cpf || cliente.cpf_cnpj || '').toLowerCase()
    const tel = (cliente.telefone || '').toLowerCase()
  const termo = searchTerm.toLowerCase()
  return nome.includes(termo) || cpf.includes(termo) || tel.includes(termo)
})

  const rangeStart = (page - 1) * pageSize + 1
  const rangeEnd = rangeStart + filteredClientes.length - 1
  const totalDisplay = typeof totalCount === 'number' ? totalCount : clientes.length

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        const token = localStorage.getItem('token')
        await api.delete(`/clientes/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        // recarrega a pagina atual
        fetchClientes()
      } catch (err) {
        console.error('Erro ao excluir cliente:', err)
      }
    }
  }

  const handlePrev = () => {
    if (page > 1) setPage((p) => p - 1)
  }

  const handleNext = () => {
    if (hasMore) setPage((p) => p + 1)
  }

const handlePageSizeChange = (e) => {
  const newSize = Number(e.target.value)
  setPageSize(newSize)
  setPage(1) // volta para a primeira pagina ao mudar o tamanho
}

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <span>Mostrar</span>
        <select
          value={pageSize}
          onChange={handlePageSizeChange}
          className="select h-9 w-24"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <span>por pagina</span>
      </div>

      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="btn-secondary"
      >
        <FiArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <button
        type="button"
        onClick={() => navigate('/clientes/novo')}
        className="btn-primary"
      >
        <FiUserPlus className="h-4 w-4" />
        Novo cliente
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="page-container">
        <PageHeader
          title="Clientes"
          subtitle="Gerencie sua base de clientes e acompanhe dados principais."
          icon={<FiUsers className="h-5 w-5" />}
          actions={headerActions}
        />
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-blue-100 bg-white/70 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 animate-pulse rounded-full bg-blue-200" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-blue-200" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <PageHeader
        title="Clientes"
        subtitle="Gerencie sua base de clientes e acompanhe dados principais."
        icon={<FiUsers className="h-5 w-5" />}
        actions={headerActions}
      />

      <div className="space-y-6">
        <div className="card p-4 sm:p-6">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquise por nome, CPF/CNPJ ou telefone"
              className="input pl-12"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {filteredClientes.length === 0 ? (
          <EmptyState
            title={searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            description={
              searchTerm
                ? 'Tente ajustar os filtros ou buscar por outro termo.'
                : 'Cadastre o primeiro cliente para iniciar os registros.'
            }
            actions={
              searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="btn-secondary"
                >
                  Limpar busca
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => navigate('/clientes/novo')}
                  className="btn-primary"
                >
                  <FiUserPlus className="h-4 w-4" />
                  Cadastrar cliente
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
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      CPF/CNPJ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Telefone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Data cadastro
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredClientes.map((cliente) => (
                    <tr key={cliente.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-600">
                            {(cliente.nome?.charAt(0) || '?').toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900">{cliente.nome}</div>
                            <div className="text-sm text-slate-500">{cliente.email || 'Sem email'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {maskCpfCnpj(cliente.cpf || cliente.cpf_cnpj)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {cliente.telefone || 'Nao informado'}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {cliente.criado_em
                          ? new Date(cliente.criado_em).toLocaleDateString('pt-BR')
                          : '--'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/clientes/editar/${cliente.id}`)}
                            className="btn-ghost h-9 w-9 rounded-full p-0 text-blue-600 hover:text-blue-700"
                            title="Editar"
                          >
                            <FiEdit />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(cliente.id)}
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

        <div className="card flex flex-col gap-3 px-4 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Pagina <span className="font-semibold text-slate-900">{page}</span>{' '}
            {filteredClientes.length > 0 ? (
              <>
                mostrando{' '}
                <span className="font-semibold text-slate-900">
                  {rangeStart}-{rangeEnd}
                </span>{' '}
                de{' '}
                <span className="font-semibold text-slate-900">
                  {totalDisplay || '--'}
                </span>{' '}
                registros
              </>
            ) : (
              'sem registros na pagina atual'
            )}{' '}
            ({pageSize} por pagina){' '}
            <span className="font-semibold text-slate-900">
              {searchTerm ? 'Total encontrados:' : 'Total geral:'}{' '}
              {typeof totalCount === 'number' ? totalCount : '--'}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={page === 1}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasMore}
              className="btn-primary disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              Proxima
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

