import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import {
  FiSave,
  FiArrowLeft,
  FiPackage,
  FiDollarSign,
  FiBox,
  FiTag,
  FiPlus,
  FiTruck,
} from 'react-icons/fi'

export default function NovoProduto() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    nome: '',
    preco_venda: '',
    custo: '',
    estoque: '',
    codigo_barras: '',
    categoria_id: '',
    fornecedor_id: ''
  })
  const [categorias, setCategorias] = useState([])
  const [fornecedores, setFornecedores] = useState([])
  const [novaCategoria, setNovaCategoria] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCategoria, setLoadingCategoria] = useState(false)
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })

  // Carregar categorias
  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await api.get('/categorias', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setCategorias(response.data)
      } catch (err) {
        console.error('Erro ao carregar categorias:', err)
        setMensagem({ texto: 'Erro ao carregar categorias', tipo: 'erro' })
      }
    }
    fetchCategorias()
  }, [])

  // Carregar fornecedores
  useEffect(() => {
    const fetchFornecedores = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await api.get('/fornecedores', {
          headers: { Authorization: `Bearer ${token}` }
        })
        setFornecedores(response.data)
      } catch (err) {
        console.error('Erro ao carregar fornecedores:', err)
        setMensagem({ texto: 'Erro ao carregar fornecedores', tipo: 'erro' })
      }
    }
    fetchFornecedores()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Salvar nova categoria
  const salvarCategoria = async () => {
    if (!novaCategoria.trim()) return
    setLoadingCategoria(true)
    try {
      const token = localStorage.getItem('token')
      const res = await api.post(
        '/categorias',
        { nome: novaCategoria },
        { headers: { Authorization: `Bearer ${token}` } }
      )

      setCategorias(prev => [...prev, res.data])
      setFormData(prev => ({ ...prev, categoria_id: res.data.id }))
      setNovaCategoria('')
    } catch (err) {
      console.error('Erro ao cadastrar categoria:', err)
      setMensagem({ texto: 'Erro ao cadastrar categoria', tipo: 'erro' })
    } finally {
      setLoadingCategoria(false)
    }
  }

  // Salvar produto
  const salvarProduto = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensagem({ texto: '', tipo: '' })

    try {
      const token = localStorage.getItem('token')

      const payload = {
        nome: formData.nome,
        preco_venda: formData.preco_venda ? Number(formData.preco_venda) : null,
        custo: formData.custo ? Number(formData.custo) : null,
        estoque: formData.estoque ? Number(formData.estoque) : 0,
        codigo_barras: formData.codigo_barras || null,
        categoria_id: formData.categoria_id || null,
        fornecedor_id: formData.fornecedor_id || null
      }

      await api.post('/produtos', payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setMensagem({
        texto: 'Produto cadastrado com sucesso! Redirecionando...',
        tipo: 'sucesso'
      })

      setTimeout(() => navigate('/produtos'), 1500)
    } catch (err) {
      console.error('Erro ao cadastrar produto:', err)
      const errorMsg = err.response?.data?.detail || 'Erro ao cadastrar produto'
      setMensagem({
        texto: typeof errorMsg === 'string' ? errorMsg : 'Erro no cadastro',
        tipo: 'erro'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold flex items-center">
              <FiPackage className="mr-2" />
              Novo Produto
            </h1>
            <button
              onClick={() => navigate('/produtos')}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition"
            >
              <FiArrowLeft className="mr-1" />
              Voltar
            </button>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={salvarProduto} className="p-6">
          {mensagem.texto && (
            <div
              className={`mb-6 p-4 rounded-lg ${
                mensagem.tipo === 'sucesso'
                  ? 'bg-green-100 text-green-800 border border-green-200'
                  : 'bg-red-100 text-red-800 border border-red-200'
              }`}
            >
              {mensagem.texto}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Nome */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome do Produto*
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ex: Camiseta Branca"
                  required
                />
                <FiPackage className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {/* Preço de Venda */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço de Venda*
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="preco_venda"
                  step="0.01"
                  min="0.01"
                  value={formData.preco_venda}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0,00"
                  required
                />
                <FiDollarSign className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {/* Custo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custo*
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="custo"
                  step="0.01"
                  min="0"
                  value={formData.custo}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0,00"
                  required
                />
                <FiDollarSign className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {/* Estoque */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estoque*
              </label>
              <div className="relative">
                <input
                  type="number"
                  name="estoque"
                  min="0"
                  value={formData.estoque}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Quantidade"
                  required
                />
                <FiBox className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {/* Categoria existente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria*
              </label>
              <div className="relative">
                <select
                  name="categoria_id"
                  value={formData.categoria_id}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
                <FiTag className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {/* Nova Categoria */}
            <div className="col-span-2 flex gap-2 items-end">
              <input
                type="text"
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Cadastrar nova categoria"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={salvarCategoria}
                disabled={loadingCategoria || !novaCategoria.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loadingCategoria ? '...' : <FiPlus />}
              </button>
            </div>

            {/* Fornecedor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fornecedor*
              </label>
              <div className="relative">
                <select
                  name="fornecedor_id"
                  value={formData.fornecedor_id}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Selecione...</option>
                  {fornecedores.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
                <FiTruck className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {/* Código de Barras */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de Barras
              </label>
              <input
                type="text"
                name="codigo_barras"
                value={formData.codigo_barras}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/produtos')}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                loading ||
                !formData.nome ||
                !formData.preco_venda ||
                !formData.custo ||
                !formData.estoque ||
                !formData.categoria_id ||
                !formData.fornecedor_id
              }
              className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" />
                  Salvar Produto
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
