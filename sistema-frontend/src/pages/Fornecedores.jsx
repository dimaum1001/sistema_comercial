import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { FiUserPlus, FiArrowLeft, FiEdit, FiTrash2, FiSearch } from 'react-icons/fi'

function useDebounced(value, delay = 300) {
  const [currentValue, setCurrentValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setCurrentValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return currentValue
}

function formatarCnpjCpf(valor) {
  if (!valor) return 'Nao informado'
  const digits = String(valor).replace(/[^0-9]/g, '')
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

function formatarTelefone(valor) {
  if (!valor) return 'Nao informado'
  const n = String(valor).replace(/\D/g, '')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return valor
}

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearch = useDebounced(searchTerm, 400)

  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalCount, setTotalCount] = useState(null)

  const navigate = useNavigate()

  const fetchFornecedores = useCallback(async () => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login')
      return
    }

    setLoading(true)
    try {
      const offset = (page - 1) * pageSize
      const limitPlusOne = pageSize + 1

      const response = await api.get('/fornecedores', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          offset,
          limit: limitPlusOne,
          q: debouncedSearch || undefined,
          search: debouncedSearch || undefined,
          term: debouncedSearch || undefined,
          nome: debouncedSearch || undefined,
        },
      })

      const data = Array.isArray(response.data) ? response.data : []
      if (data.length > pageSize) {
        setHasMore(true)
        setFornecedores(data.slice(0, pageSize))
      } else {
        setHasMore(false)
        setFornecedores(data)
      }
    } catch (err) {
      console.error('Erro ao buscar fornecedores:', err)
      setHasMore(false)
      setFornecedores([])
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, navigate, page, pageSize])

  const fetchTotal = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const chunk = 1000
      let offset = 0
      let total = 0

      for (let guard = 0; guard < 200; guard += 1) {
        const resp = await api.get('/fornecedores', {
          headers: { Authorization: `Bearer ${token}` },
          params: { offset, limit: chunk },
        })
        const arr = Array.isArray(resp.data) ? resp.data : []
        total += arr.length
        if (arr.length < chunk) break
        offset += chunk
      }

      setTotalCount(total)
    } catch (error) {
      console.error('Erro ao obter total de fornecedores:', error)
      setTotalCount(null)
    }
  }, [])

  useEffect(() => {
    fetchFornecedores()
  }, [fetchFornecedores])

  useEffect(() => {
    fetchTotal()
  }, [fetchTotal])

  const filteredFornecedores = fornecedores.filter((fornecedor) => {
    const termo = searchTerm.toLowerCase()
    const nome = (fornecedor.nome || fornecedor.razao_social || '').toLowerCase()
    const cnpj = (fornecedor.cnpj_cpf || '').toLowerCase()
    const email = (fornecedor.email || '').toLowerCase()
    const telefone = (fornecedor.telefone || '').toLowerCase()
    return nome.includes(termo) || cnpj.includes(termo) || email.includes(termo) || telefone.includes(termo)
  })

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este fornecedor?')) {
      try {
        const token = localStorage.getItem('token')
        await api.delete(`/fornecedores/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        fetchFornecedores()
        fetchTotal()
      } catch (err) {
        console.error('Erro ao excluir fornecedor:', err)
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
        <h2 className="text-2xl font-bold text-gray-800">Fornecedores Cadastrados</h2>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Mostrar</label>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">por pagina</span>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
          >
            <FiArrowLeft className="mr-2" />
            Voltar
          </button>
          <button
            onClick={() => navigate('/fornecedores/cadastrar')}
            className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <FiUserPlus className="mr-2" />
            Novo Fornecedor
          </button>
        </div>
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Pesquisar fornecedores por nome, CNPJ/CPF, e-mail ou telefone..."
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
        />
      </div>

      {filteredFornecedores.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'Nenhum fornecedor encontrado para a pesquisa nesta pagina.' : 'Nenhum fornecedor nesta pagina.'}
          </p>
          <button
            onClick={() => navigate('/fornecedores/cadastrar')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Cadastrar Primeiro Fornecedor
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome / Razao Social
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CNPJ/CPF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Cadastro
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredFornecedores.map((fornecedor) => {
                  const nomeOuRazao = fornecedor.nome || fornecedor.razao_social || '-'
                  return (
                    <tr key={fornecedor.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium">
                              {(nomeOuRazao.charAt(0) || '?').toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{nomeOuRazao}</div>
                            <div className="text-sm text-gray-500">{fornecedor.email || 'Sem e-mail'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatarCnpjCpf(fornecedor.cnpj_cpf)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatarTelefone(fornecedor.telefone)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {fornecedor.criado_em ? new Date(fornecedor.criado_em).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/fornecedores/editar/${fornecedor.id}`)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition"
                            title="Editar"
                          >
                            <FiEdit />
                          </button>
                          <button
                            onClick={() => handleDelete(fornecedor.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition"
                            title="Excluir"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white px-6 py-3 rounded-b-xl shadow-sm">
        <div className="text-sm text-gray-500">
          Pagina <span className="font-medium">{page}</span> mostrando{' '}
          <span className="font-medium">{filteredFornecedores.length}</span> de{' '}
          <span className="font-medium">{fornecedores.length}</span> registros carregados ({pageSize} por pagina)
          {' | '}
          <span className="font-medium">
            Total geral: {typeof totalCount === 'number' ? totalCount : '--'}
          </span>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handlePrev}
            disabled={page === 1}
            className={`px-3 py-1 rounded-md ${
              page === 1
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 transition'
            }`}
          >
            Anterior
          </button>
          <button
            onClick={handleNext}
            disabled={!hasMore}
            className={`px-3 py-1 rounded-md ${
              !hasMore
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
