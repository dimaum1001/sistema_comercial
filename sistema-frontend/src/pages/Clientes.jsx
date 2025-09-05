import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { FiUserPlus, FiArrowLeft, FiEdit, FiTrash2, FiSearch } from 'react-icons/fi'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      navigate('/login')
      return
    }

    const fetchClientes = async () => {
      try {
        const response = await api.get('/clientes', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setClientes(response.data)
      } catch (err) {
        console.error('Erro ao buscar clientes:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchClientes()
  }, [navigate])

  const filteredClientes = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.cpf.includes(searchTerm) ||
    cliente.telefone.includes(searchTerm)
  )

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        const token = localStorage.getItem('token')
        await api.delete(`/clientes/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setClientes(clientes.filter(cliente => cliente.id !== id))
      } catch (err) {
        console.error('Erro ao excluir cliente:', err)
      }
    }
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
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Clientes Cadastrados</h2>
        <div className="flex space-x-4">
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
          placeholder="Pesquisar clientes por nome, CPF ou telefone..."
          className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredClientes.length === 0 ? (
        <div className="bg-white p-8 rounded-xl shadow-sm text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'Nenhum cliente encontrado para a pesquisa.' : 'Nenhum cliente cadastrado ainda.'}
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
                    CPF
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Telefone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data Cadastro
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
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
                            {cliente.nome.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{cliente.nome}</div>
                          <div className="text-sm text-gray-500">{cliente.email || 'Sem e-mail'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.cpf || 'Não informado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {cliente.telefone || 'Não informado'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(cliente.criado_em).toLocaleDateString('pt-BR')}
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

      {/* Paginação (opcional) */}
      {filteredClientes.length > 0 && (
        <div className="mt-4 flex justify-between items-center bg-white px-6 py-3 rounded-b-xl shadow-sm">
          <div className="text-sm text-gray-500">
            Mostrando <span className="font-medium">{filteredClientes.length}</span> de{' '}
            <span className="font-medium">{clientes.length}</span> clientes
          </div>
          <div className="flex space-x-2">
            <button className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition">
              Anterior
            </button>
            <button className="px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition">
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}