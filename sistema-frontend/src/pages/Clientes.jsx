import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { FiUserPlus, FiArrowLeft, FiEdit, FiTrash2, FiSearch } from 'react-icons/fi'

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

  // paginacao
  const [pageSize, setPageSize] = useState(10) // 10, 25, 50, 100
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // total geral (tabela inteira no banco)
  const [totalCount, setTotalCount] = useState(null)

  const navigate = useNavigate()

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

      const response = await api.get('/clientes', {
        headers: { Authorization: `Bearer ${token}` },
        params: { skip, limit: limitPlusOne },
      })

      const data = Array.isArray(response.data) ? response.data : []
      if (data.length > pageSize) {
        setHasMore(true)
        setClientes(data.slice(0, pageSize))
      } else {
        setHasMore(false)
        setClientes(data)
      }
    } catch (err) {
      console.error('Erro ao buscar clientes:', err)
      setHasMore(false)
      setClientes([])
    } finally {
      setLoading(false)
    }
  }, [navigate, page, pageSize])

  // Conta o total geral com varias requisicoes (robusto, sem depender de headers)
  const fetchTotal = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
      const chunk = 1000
      let skip = 0
      let total = 0

      // guarda para evitar loop infinito em caso de erro de backend
      for (let guard = 0; guard < 200; guard++) {
        const resp = await api.get('/clientes', {
          headers: { Authorization: `Bearer ${token}` },
          params: { skip, limit: chunk },
        })
        const arr = Array.isArray(resp.data) ? resp.data : []
        total += arr.length
        if (arr.length < chunk) break
        skip += chunk
      }

      setTotalCount(total)
    } catch (e) {
      console.error('Erro ao obter total de clientes:', e)
      setTotalCount(null)
    }
  }, [])

  useEffect(() => {
    fetchClientes()
  }, [fetchClientes])

  useEffect(() => {
    fetchTotal()
  }, [fetchTotal])

  const filteredClientes = clientes.filter((cliente) => {
    const nome = (cliente.nome || '').toLowerCase()
    const cpf = (cliente.cpf || cliente.cpf_cnpj || '').toLowerCase()
    const tel = (cliente.telefone || '').toLowerCase()
    const termo = searchTerm.toLowerCase()
    return nome.includes(termo) || cpf.includes(termo) || tel.includes(termo)
  })

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        const token = localStorage.getItem('token')
        await api.delete(`/clientes/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        // recarrega a pagina atual e o total geral
        fetchClientes()
        fetchTotal()
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
        <h2 className="text-2xl font-bold text-gray-800">Clientes Cadastrados</h2>

        <div className="flex items-center gap-3">
          {/* seletor de quantidade por pagina */}
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
            onClick={() => navigate('/clientes/novo')}
            className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            <FiUserPlus className="mr-2" />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Barra de pesquisa */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FiSearch className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Pesquisar clientes por nome, CPF/CNPJ ou telefone..."
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredClientes.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'Nenhum cliente encontrado para a pesquisa nesta pagina.' : 'Nenhum cliente nesta pagina.'}
          </p>
          <button
            onClick={() => navigate('/clientes/novo')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Cadastrar Primeiro Cliente
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPF/CNPJ
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
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium">
                            {(cliente.nome?.charAt(0) || '?').toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{cliente.nome}</div>
                          <div className="text-sm text-gray-500">{cliente.email || 'Sem e-mail'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {maskCpfCnpj(cliente.cpf || cliente.cpf_cnpj)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.telefone || 'Nao informado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.criado_em ? new Date(cliente.criado_em).toLocaleDateString('pt-BR')  : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => navigate(`/clientes/editar/${cliente.id}`)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition"
                          title="Editar"
                        >
                          <FiEdit />
                        </button>
                        <button
                          onClick={() => handleDelete(cliente.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition"
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

      {/* Paginacao + total (Total geral SEMPRE vem do banco) */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white px-6 py-3 rounded-b-xl shadow-sm">
        <div className="text-sm text-gray-500">
          Pagina <span className="font-medium">{page}</span> mostrando{' '}
          <span className="font-medium">{filteredClientes.length}</span> de{' '}
          <span className="font-medium">{clientes.length}</span> registros carregados ({pageSize} por pagina)
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




