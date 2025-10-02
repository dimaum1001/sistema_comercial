import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

const initialForm = {
  codigo_produto: '',
  nome: '',
  codigo_barras: '',
  categoria_id: '',
  fornecedor_id: '',
  fornecedor: '',
  custo: '',
  preco_venda: '',
  estoque: '',
  estoque_minimo: '',
  unidade: '',
  marca: '',
  localizacao: '',
  data_validade: '',
  ativo: 'true',
}

export default function RegisterProduct() {
  const [form, setForm] = useState(initialForm)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const navigate = useNavigate()

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErro('')
    setSucesso('')

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      const payload = {}

      const trimmedFields = ['codigo_produto', 'nome', 'codigo_barras', 'unidade', 'marca', 'fornecedor', 'localizacao']
      trimmedFields.forEach((key) => {
        const value = form[key]?.trim()
        if (value) payload[key] = value
      })

      if (form.categoria_id.trim()) {
        payload.categoria_id = form.categoria_id.trim()
      }

      if (form.fornecedor_id.trim()) {
        payload.fornecedor_id = form.fornecedor_id.trim()
      }

      const intFields = { estoque: form.estoque, estoque_minimo: form.estoque_minimo }
      Object.entries(intFields).forEach(([key, value]) => {
        const trimmed = value.trim()
        if (trimmed !== '') {
          const parsed = Number.parseInt(trimmed, 10)
          if (!Number.isNaN(parsed)) {
            payload[key] = parsed
          }
        }
      })

      const floatFields = { custo: form.custo, preco_venda: form.preco_venda }
      Object.entries(floatFields).forEach(([key, value]) => {
        const trimmed = value.replace(',', '.').trim()
        if (trimmed !== '') {
          const parsed = Number.parseFloat(trimmed)
          if (!Number.isNaN(parsed)) {
            payload[key] = parsed
          }
        }
      })

      if (form.data_validade) {
        payload.data_validade = form.data_validade
      }

      payload.ativo = form.ativo === 'true'

      await api.post('/produtos', payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSucesso('Produto cadastrado com sucesso!')
      setForm(initialForm)
    } catch (error) {
      const message = error?.response?.data?.detail || 'Erro ao cadastrar produto.'
      setErro(message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-full max-w-3xl">
        <h2 className="text-2xl font-bold mb-4 text-center">Cadastrar Produto</h2>
        {erro && <p className="text-red-500 mb-3 text-center">{erro}</p>}
        {sucesso && <p className="text-green-600 mb-3 text-center">{sucesso}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código do Produto</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.codigo_produto}
              onChange={handleChange('codigo_produto')}
              placeholder="Opcional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.nome}
              onChange={handleChange('nome')}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.codigo_barras}
              onChange={handleChange('codigo_barras')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria ID</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.categoria_id}
              onChange={handleChange('categoria_id')}
              placeholder="UUID da categoria"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor ID</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.fornecedor_id}
              onChange={handleChange('fornecedor_id')}
              placeholder="UUID do fornecedor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor (texto)</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.fornecedor}
              onChange={handleChange('fornecedor')}
              placeholder="Nome do fornecedor livre"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custo (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              className="w-full p-2 border rounded"
              value={form.custo}
              onChange={handleChange('custo')}
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$)</label>
            <input
              type="text"
              inputMode="decimal"
              className="w-full p-2 border rounded"
              value={form.preco_venda}
              onChange={handleChange('preco_venda')}
              placeholder="0,00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estoque</label>
            <input
              type="number"
              className="w-full p-2 border rounded"
              value={form.estoque}
              onChange={handleChange('estoque')}
              min="0"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estoque Mínimo</label>
            <input
              type="number"
              className="w-full p-2 border rounded"
              value={form.estoque_minimo}
              onChange={handleChange('estoque_minimo')}
              min="0"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.unidade}
              onChange={handleChange('unidade')}
              placeholder="Ex: un, cx, kg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marca</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.marca}
              onChange={handleChange('marca')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Localização</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={form.localizacao}
              onChange={handleChange('localizacao')}
              placeholder="Ex: Corredor A, prateleira 3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data de Validade</label>
            <input
              type="date"
              className="w-full p-2 border rounded"
              value={form.data_validade}
              onChange={handleChange('data_validade')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full p-2 border rounded"
              value={form.ativo}
              onChange={handleChange('ativo')}
            >
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="submit"
            className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition"
          >
            Cadastrar
          </button>
          <button
            type="button"
            onClick={() => setForm(initialForm)}
            className="w-full bg-gray-200 text-gray-700 p-2 rounded hover:bg-gray-300 transition"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={() => navigate('/produtos')}
            className="w-full bg-gray-300 text-black p-2 rounded hover:bg-gray-400 transition"
          >
            Voltar
          </button>
        </div>
      </form>
    </div>
  )
}
