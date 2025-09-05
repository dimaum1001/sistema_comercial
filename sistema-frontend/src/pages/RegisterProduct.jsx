import { useState } from 'react'
import axios from '../services/api'
import { useNavigate } from 'react-router-dom'

export default function RegisterProduct() {
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [estoque, setEstoque] = useState('')
  const [categoria, setCategoria] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErro('')
    setSucesso('')

    try {
      const token = localStorage.getItem('token')
      await axios.post('/produtos', {
        nome,
        preco: parseFloat(preco),
        estoque: parseInt(estoque),
        categoria
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      setSucesso('Produto cadastrado com sucesso!')
      setNome('')
      setPreco('')
      setEstoque('')
      setCategoria('')
    } catch (err) {
      setErro(err.response?.data?.detail || 'Erro ao cadastrar produto.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center">Cadastrar Produto</h2>
        {erro && <p className="text-red-500 mb-2">{erro}</p>}
        {sucesso && <p className="text-green-600 mb-2">{sucesso}</p>}

        <input
          type="text"
          placeholder="Nome do Produto"
          className="w-full mb-4 p-2 border rounded"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Preço"
          className="w-full mb-4 p-2 border rounded"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
          required
          min="0"
          step="0.01"
        />

        <input
          type="number"
          placeholder="Estoque"
          className="w-full mb-4 p-2 border rounded"
          value={estoque}
          onChange={(e) => setEstoque(e.target.value)}
          required
          min="0"
        />

        <input
          type="text"
          placeholder="Categoria"
          className="w-full mb-4 p-2 border rounded"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 transition"
        >
          Cadastrar
        </button>

        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="w-full mt-2 bg-gray-300 text-black p-2 rounded hover:bg-gray-400 transition"
        >
          Voltar
        </button>
      </form>
    </div>
  )
}
