import { useState } from 'react'
import axios from '../services/api'
import { useNavigate, Link } from 'react-router-dom'
import { FiLogIn, FiMail, FiLock, FiEye, FiEyeOff } from 'react-icons/fi'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setErro('')
    
    try {
      const { data } = await axios.post('/auth/login', { email, senha })

      // Salva token/usuário
      localStorage.setItem('token', data.access_token)
      if (data.usuario) {
        localStorage.setItem('usuario', JSON.stringify(data.usuario))
      }

      // Garante que próximas requisições já vão autenticadas
      axios.defaults.headers.common.Authorization = `Bearer ${data.access_token}`

      // Notifica a aplicação que o estado de auth mudou (mesma aba)
      window.dispatchEvent(new Event('auth-changed'))

      // Vai para o dashboard
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setErro(err?.response?.data?.detail || 'Credenciais inválidas. Por favor, tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Sistema Comercial</h1>
          <p className="text-gray-600">Gerencie seu negócio de forma eficiente</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
            <h2 className="text-2xl font-bold flex items-center justify-center">
              <FiLogIn className="mr-2" />
              Acesse sua conta
            </h2>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-6">
            {erro && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-red-700">{erro}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="senha" className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="text-gray-400" />
                </div>
                <input
                  id="senha"
                  type={showPassword ? "text" : "password"}
                  placeholder="Sua senha"
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FiEyeOff className="text-gray-400 hover:text-gray-500" />
                  ) : (
                    <FiEye className="text-gray-400 hover:text-gray-500" />
                  )}
                </button>
              </div>
              <div className="mt-1 text-right">
                <Link 
                  to="/esqueci-senha" 
                  className="text-sm text-blue-600 hover:underline"
                >
                  Esqueceu sua senha?
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Carregando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <div className="px-6 pb-6 text-center">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{' '}
              <Link 
                to="/register" 
                className="font-medium text-blue-600 hover:text-blue-500 hover:underline"
              >
                Cadastre-se agora
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
