import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { FiPlus, FiEdit2, FiTrash2, FiSearch, FiArrowLeft, FiBox } from 'react-icons/fi'

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

      const response = await api.get('/produtos', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          offset,
          limit: limitPlusOne,
          q: searchValue || undefined,
          search: searchValue || undefined,
          term: searchValue || undefined,
          nome: searchValue || undefined,
        },
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

      if (total == null) {
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

      setMessage((prev) => (prev?.tipo === 'erro' ? null : prev))
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      setProdutos([])
      setHasMore(false)
      setTotalCount(null)
      setMessage({ tipo: 'erro', texto: 'Erro ao carregar produtos' })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, fetchTotalFallback, navigate, page, pageSize])

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-blue-200 rounded-full mb-4"></div>
          <div className="h-4 w-32 bg-blue-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FiBox /> Produtos Cadastrados
        </h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Mostrar</label>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">por pagina</span>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            type="button"
          >
            <FiArrowLeft className="mr-2" />
            Voltar
          </button>
          <button
            onClick={() => navigate('/produtos/novo')}
            className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
            type="button"
          >
            <FiPlus className="mr-2" />
            Novo Produto
          </button>
        </div>
      </div>

      {message ? (
        <div
          className={`mb-4 p-3 rounded border ${
            message.tipo === 'erro'
              ? 'bg-red-100 border-red-300 text-red-700'
              : 'bg-green-100 border-green-300 text-green-700'
          }`}
        >
          {message.texto}
        </div>
      ) : null}

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Pesquisar produtos por nome, categoria, fornecedor, marca ou codigo..."
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setPage(1)
          }}
        />
      </div>

      {produtos.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm
              ? 'Nenhum produto encontrado para a pesquisa nesta pagina.'
              : 'Nenhum produto cadastrado ainda.'}
          </p>
          <button
            onClick={() => navigate('/produtos/novo')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            type="button"
          >
            Cadastrar Primeiro Produto
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Codigo de Barras
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fornecedor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Custo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preco de Venda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estoque
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unidade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Marca
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Localizacao
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cadastrado em
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Atualizado em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {produtos.map((produto) => (
                  <tr key={produto.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" title={produto.codigo_barras || '-'}>
                      {produto.codigo_barras || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" title={produto.nome || '-'}>
                      {produto.nome || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600" title={
                      produto?.fornecedor?.nome || produto?.fornecedor_obj?.nome || produto?.fornecedor || '-'
                    }>
                      {produto?.fornecedor?.nome || produto?.fornecedor_obj?.nome || produto?.fornecedor || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {fmtBRL(Number(produto.custo))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {fmtBRL(Number(produto.preco_venda))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          (produto.estoque ?? 0) <= 0
                            ? 'bg-red-100 text-red-800'
                            : (produto.estoque ?? 0) < 10
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {produto.estoque ?? 0} un.
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {produto.unidade || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {produto?.categoria?.nome || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {produto.marca || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {produto.localizacao || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {produto.criado_em ? new Date(produto.criado_em).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {produto.atualizado_em
                        ? new Date(produto.atualizado_em).toLocaleDateString('pt-BR')
                        : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/produtos/editar/${produto.id}`)}
                          className="text-blue-600 hover:text-blue-900 p-1.5 rounded-full hover:bg-blue-50 transition"
                          title="Editar"
                          type="button"
                          aria-label={`Editar ${produto?.nome || 'produto'}`}
                        >
                          <FiEdit2 />
                        </button>
                        <button
                          onClick={() => handleDelete(produto.id)}
                          className="text-red-600 hover:text-red-900 p-1.5 rounded-full hover:bg-red-50 transition"
                          title="Excluir"
                          type="button"
                          aria-label={`Excluir ${produto?.nome || 'produto'}`}
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

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white px-6 py-3 rounded-b-xl shadow-sm">
        <div className="text-sm text-gray-500">
          Pagina <span className="font-medium">{currentPage}</span>{' '}
          {produtos.length > 0 && typeof totalCount === 'number' ? (
            <>
              mostrando <span className="font-medium">{rangeStart}-{rangeEnd}</span>{' '}
              de <span className="font-medium">{totalCount}</span> produtos
            </>
          ) : (
            <>mostrando <span className="font-medium">{produtos.length}</span> produtos</>
          )}{' '}
          ({pageSize} por pagina) {' | '}
          <span className="font-medium">
            Total geral: {typeof totalCount === 'number' ? totalCount : '--'}
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handlePrev}
            disabled={disablePrev}
            className={`px-3 py-1 rounded-md ${
              disablePrev
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 transition'
            }`}
          >
            Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={disableNext}
            className={`px-3 py-1 rounded-md ${
              disableNext
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 transition'
            }`}
          >
            Proxima
          </button>
        </div>
      </div>
    </div>
  )
}
