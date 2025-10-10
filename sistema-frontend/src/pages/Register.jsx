import { useState } from 'react'
import axios from '../services/api'
import { useNavigate, Link } from 'react-router-dom'
import { FiUser, FiMail, FiLock, FiUserPlus, FiArrowLeft, FiEye, FiEyeOff } from 'react-icons/fi'

export default function Register() {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    tipo: 'cliente'
  })
  const [aceitouPolitica, setAceitouPolitica] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    // Validação básica
    if (!formData.nome || !formData.email || !formData.senha) {
      setError('Preencha todos os campos obrigatórios')
      setLoading(false)
      return
    }

    if (!aceitouPolitica) {
      setError('Voce precisa aceitar a Politica de Privacidade para continuar.')
      setLoading(false)
      return
    }

    try {
      const response = await axios.post('/auth/register', {
        nome: formData.nome.trim(),
        email: formData.email.trim(),
        senha: formData.senha,
        tipo: formData.tipo
      })
      
      if (response.status === 201) {
        setSuccess(true)
        setTimeout(() => navigate('/login'), 2000)
      }
    } catch (err) {
      console.error('Registration error:', err)
      setError(err.response?.data?.detail || err.response?.data?.message || 'Erro no cadastro. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="text-white hover:text-blue-200 transition"
            >
              <FiArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-bold flex items-center">
              <FiUserPlus className="mr-2" />
              Criar Conta
            </h2>
            <div className="w-6"></div> {/* Espaçador */}
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded">
              <p>Cadastro realizado com sucesso! Redirecionando...</p>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
            <div className="relative">
              <FiUser className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                name="nome"
                placeholder="Seu nome completo"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.nome}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <div className="relative">
              <FiMail className="absolute left-3 top-3 text-gray-400" />
              <input
                type="email"
                name="email"
                placeholder="seu@email.com"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha *</label>
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                name="senha"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.senha}
                onChange={handleChange}
              />
              <button
                type="button"
                className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
            Ao criar uma conta você receberá o perfil "cliente". Perfis administrativos só podem ser atribuídos por um administrador do sistema.
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-600">
            <input
              id="aceite-politica"
              type="checkbox"
              className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
              checked={aceitouPolitica}
              onChange={(e) => setAceitouPolitica(e.target.checked)}
            />
            <label htmlFor="aceite-politica" className="leading-tight">
              Li e concordo com a <Link className="text-blue-600 hover:underline" to="/politica-privacidade">Politica de Privacidade</Link> e autorizo o tratamento dos dados para as finalidades descritas.
            </label>
          </div>

          {/* Botão de Cadastro */}
          <button
            type="submit"
            disabled={loading || !aceitouPolitica}
            className={`w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center ${
              loading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-blue-700'
            }`}
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Cadastrando...
              </>
            ) : (
              'Cadastrar'
            )}
          </button>
        </form>

        {/* Rodapé */}
        <div className="px-6 pb-6 text-center">
          <p className="text-sm text-gray-600">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium">
              Faça login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}