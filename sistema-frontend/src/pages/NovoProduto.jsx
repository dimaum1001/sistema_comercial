import { useState, useEffect, useRef } from 'react'
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
  FiX,
} from 'react-icons/fi'

const INITIAL_FORM = {
  nome: '',
  preco_venda: '',
  custo: '',
  custo_medio: '',
  estoque: '',
  estoque_minimo: '',
  unidade_id: '',
  marca: '',
  localizacao: '',
  data_validade: '',
  codigo_barras: '',
  categoria_id: '',
  fornecedor_id: '',
  fornecedor_texto: '',
  ativo: true
}

export default function NovoProduto() {
  const navigate = useNavigate()
  const usuarioRaw = localStorage.getItem('usuario')
  const usuario = usuarioRaw ? JSON.parse(usuarioRaw) : null
  const isAdmin = String(usuario?.tipo || '').toLowerCase() === 'admin'
  const [formData, setFormData] = useState(INITIAL_FORM)
  const [categorias, setCategorias] = useState([])
  const [unidades, setUnidades] = useState([])
  const [unidadesLoading, setUnidadesLoading] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingCategoria, setLoadingCategoria] = useState(false)
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })
  const [fornecedorTerm, setFornecedorTerm] = useState('')
  const [fornecedorResultados, setFornecedorResultados] = useState([])
  const [fornecedorLoading, setFornecedorLoading] = useState(false)
  const [fornecedorAberto, setFornecedorAberto] = useState(false)
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState(null)
  const fornecedorBoxRef = useRef(null)

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

  useEffect(() => {
    const fetchUnidades = async () => {
      try {
        setUnidadesLoading(true)
        const token = localStorage.getItem('token')
        const response = await api.get('/unidades-medida', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const lista = Array.isArray(response.data) ? response.data : response.data?.items || []
        setUnidades(lista)
      } catch (err) {
        console.error('Erro ao carregar unidades de medida:', err)
        setMensagem({ texto: 'Erro ao carregar unidades de medida', tipo: 'erro' })
      } finally {
        setUnidadesLoading(false)
      }
    }

    fetchUnidades()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fornecedorBoxRef.current && !fornecedorBoxRef.current.contains(event.target)) {
        setFornecedorAberto(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    const term = fornecedorTerm.trim()

    if (fornecedorSelecionado && term === (fornecedorSelecionado.nome || '')) {
      setFornecedorResultados([])
      setFornecedorAberto(false)
      setFornecedorLoading(false)
      return
    }

    if (term.length < 2) {
      setFornecedorResultados([])
      setFornecedorAberto(false)
      setFornecedorLoading(false)
      return
    }

    let cancelado = false
    setFornecedorLoading(true)

    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/fornecedores', {
          params: { q: term, page: 1, per_page: 10 },
        })

        if (cancelado) {
          return
        }

        const lista = Array.isArray(response.data) ? response.data : response.data?.items || []
        setFornecedorResultados(lista)
        setFornecedorAberto(true)
      } catch (err) {
        if (!cancelado) {
          console.error('Erro ao buscar fornecedores:', err)
          setFornecedorResultados([])
          setFornecedorAberto(false)
        }
      } finally {
        if (!cancelado) {
          setFornecedorLoading(false)
        }
      }
    }, 300)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [fornecedorTerm, fornecedorSelecionado])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => {
      if (name === 'custo') {
        const next = { ...prev, custo: value }
        if (!prev.custo_medio) {
          next.custo_medio = value
        }
        return next
      }
      if (name === 'custo_medio') {
        return { ...prev, custo_medio: value }
      }
      return {
        ...prev,
        [name]: value
      }
    })
  }

  const handleAtivoChange = (e) => {
    setFormData((prev) => ({ ...prev, ativo: e.target.checked }))
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

      const parseDecimal = (value) => {
        if (!value) return null
        const normalized = String(value).replace(',', '.').trim()
        const parsed = Number.parseFloat(normalized)
        return Number.isNaN(parsed) ? null : parsed
      }

      const parseInteger = (value) => {
        if (!value && value !== 0) return null
        const parsed = Number.parseInt(value, 10)
        return Number.isNaN(parsed) ? null : parsed
      }

      const payload = {
        nome: formData.nome.trim(),
        preco_venda: parseDecimal(formData.preco_venda),
        custo: parseDecimal(formData.custo),
        custo_medio: parseDecimal(formData.custo_medio),
        estoque: parseInteger(formData.estoque) ?? 0,
        estoque_minimo: parseInteger(formData.estoque_minimo),
        marca: formData.marca.trim() || null,
        localizacao: formData.localizacao.trim() || null,
        data_validade: formData.data_validade || null,
        codigo_barras: formData.codigo_barras.trim() || null,
        categoria_id: formData.categoria_id || null,
        fornecedor_id: formData.fornecedor_id || null,
        fornecedor: formData.fornecedor_texto.trim() || null,
        ativo: Boolean(formData.ativo),
      }

      const unidadeId = (formData.unidade_id || '').trim()
      if (unidadeId) {
        payload.unidade_id = unidadeId
      }

      await api.post('/produtos', payload, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setMensagem({
        texto: 'Produto cadastrado com sucesso! Redirecionando...',
        tipo: 'sucesso'
      })

      setFormData(INITIAL_FORM)
      setFornecedorTerm('')
      setFornecedorSelecionado(null)
      setFornecedorResultados([])
      setFornecedorAberto(false)

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
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => navigate('/admin/unidades')}
                  className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition"
                >
                  <FiTag className="mr-1" />
                  Unidades de Medida
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/produtos')}
                className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition"
              >
                <FiArrowLeft className="mr-1" />
                Voltar
              </button>
            </div>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto*</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda*</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custo (última compra)*</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custo médio*</label>
              <div className="relative">
                <input
                  type="number"
                  name="custo_medio"
                  step="0.01"
                  min="0"
                  value={formData.custo_medio}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0,00"
                  required
                />
                <FiDollarSign className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estoque*</label>
              <div className="relative">
                <input
                  type="number"
                  name="estoque"
                  min="0"
                  value={formData.estoque}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Quantidade atual"
                  required
                />
                <FiBox className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estoque mínimo</label>
              <input
                type="number"
                name="estoque_minimo"
                min="0"
                value={formData.estoque_minimo}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unidade de Medida*</label>
              <select
                name="unidade_id"
                value={formData.unidade_id}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={unidadesLoading || unidades.length === 0}
              >
                <option value="">Selecione a unidade</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.sigla} - {u.nome}
                  </option>
                ))}
              </select>
              {unidadesLoading ? (
                <p className="text-xs text-gray-500 mt-1">Carregando unidades...</p>
              ) : unidades.length === 0 ? (
                <p className="text-xs text-red-500 mt-1">
                  Nenhuma unidade encontrada. Cadastre pelo menos uma antes de prosseguir.
                </p>
              ) : (
                isAdmin ? (
                  <button
                    type="button"
                    onClick={() => navigate('/admin/unidades')}
                    className="text-xs text-blue-600 hover:underline underline-offset-2 mt-1"
                  >
                    Gerenciar unidades de medida
                  </button>
                ) : null
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
              <input
                type="text"
                name="marca"
                value={formData.marca}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opcional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
              <input
                type="text"
                name="localizacao"
                value={formData.localizacao}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Corredor A - Prateleira 3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de validade</label>
              <input
                type="date"
                name="data_validade"
                value={formData.data_validade}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoria*</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor*</label>
              <div className="relative" ref={fornecedorBoxRef}>
                <FiTruck className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={fornecedorTerm}
                  onChange={(e) => {
                    const value = e.target.value
                    setFornecedorTerm(value)
                    setFornecedorSelecionado(null)
                    setFormData((prev) => ({ ...prev, fornecedor_id: '' }))
                  }}
                  onFocus={() => {
                    if (fornecedorResultados.length > 0) {
                      setFornecedorAberto(true)
                    }
                  }}
                  placeholder="Digite 2+ letras para buscar..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="off"
                />
                {fornecedorTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setFornecedorTerm('')
                      setFornecedorSelecionado(null)
                      setFornecedorResultados([])
                      setFornecedorAberto(false)
                      setFormData((prev) => ({ ...prev, fornecedor_id: '' }))
                    }}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                    aria-label="Limpar fornecedor"
                  >
                    <FiX />
                  </button>
                )}
                {fornecedorLoading && (
                  <svg
                    className="animate-spin h-4 w-4 text-blue-500 absolute right-3 top-3"
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
                )}
                <input type="hidden" name="fornecedor_id" value={formData.fornecedor_id} required />
                {fornecedorAberto && (
                  <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {fornecedorResultados.length === 0 && !fornecedorLoading ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        Nenhum fornecedor encontrado
                      </div>
                    ) : (
                      fornecedorResultados.map((fornecedor) => {
                        const nome = fornecedor.nome || fornecedor.razao_social || ''
                        return (
                          <button
                            type="button"
                            key={fornecedor.id}
                            onMouseDown={(e) => {
                              e.preventDefault()
                              setFornecedorSelecionado(fornecedor)
                              setFornecedorTerm(nome)
                              setFormData((prev) => ({ ...prev, fornecedor_id: fornecedor.id }))
                              setFornecedorAberto(false)
                              setFornecedorResultados([])
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 focus:bg-blue-50"
                          >
                            <div className="font-medium text-gray-700">{nome}</div>
                            {(fornecedor.codigo_fornecedor || fornecedor.cnpj_cpf) && (
                              <div className="text-xs text-gray-500">
                                {fornecedor.codigo_fornecedor ? `${fornecedor.codigo_fornecedor} ` : ''}
                                {fornecedor.cnpj_cpf}
                              </div>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome externo do fornecedor</label>
              <input
                type="text"
                name="fornecedor_texto"
                value={formData.fornecedor_texto}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opcional (exibição no catálogo)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de barras</label>
              <input
                type="text"
                name="codigo_barras"
                value={formData.codigo_barras}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Opcional"
              />
            </div>

            <div className="col-span-2 flex items-center gap-2">
              <input
                id="produto-ativo"
                type="checkbox"
                checked={formData.ativo}
                onChange={handleAtivoChange}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
              />
              <label htmlFor="produto-ativo" className="text-sm text-gray-700">Produto ativo</label>
            </div>
          </div>          {/* Botões */}
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
                !formData.custo_medio ||
                !formData.estoque ||
                !formData.categoria_id ||
                !formData.unidade_id ||
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
