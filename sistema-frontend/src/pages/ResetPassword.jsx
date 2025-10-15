import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FiKey, FiLock, FiEye, FiEyeOff, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi'
import axios from '../services/api'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [token, setToken] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [feedback, setFeedback] = useState({ type: null, message: '' })
  const [loading, setLoading] = useState(false)
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmacao, setShowConfirmacao] = useState(false)
  const redirectTimeout = useRef()

  useEffect(() => {
    const tokenQuery = searchParams.get('token')
    if (tokenQuery) {
      setToken(tokenQuery)
    }
  }, [searchParams])

  useEffect(() => {
    return () => {
      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
      }
    }
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    if (!token.trim()) {
      setFeedback({ type: 'error', message: 'Informe o codigo recebido por e-mail.' })
      return
    }

    if (novaSenha.length < 6) {
      setFeedback({ type: 'error', message: 'A nova senha deve ter pelo menos 6 caracteres.' })
      return
    }

    if (novaSenha !== confirmacao) {
      setFeedback({ type: 'error', message: 'As senhas digitadas nao conferem.' })
      return
    }

    setLoading(true)
    setFeedback({ type: null, message: '' })

    try {
      await axios.post('/auth/reset-password', {
        token: token.trim(),
        nova_senha: novaSenha,
      })

      setFeedback({
        type: 'success',
        message: 'Senha atualizada com sucesso. Voce ja pode acessar o sistema novamente.',
      })
      setNovaSenha('')
      setConfirmacao('')

      if (redirectTimeout.current) {
        clearTimeout(redirectTimeout.current)
      }
      redirectTimeout.current = setTimeout(() => {
        navigate('/login')
      }, 2500)
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        'Nao foi possivel redefinir a senha. Verifique o codigo e tente outra vez.'
      setFeedback({ type: 'error', message: detail })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-50 p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6">
          <Link
            to="/login"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 transition-colors"
          >
            <FiKey className="mr-2" />
            Voltar para login
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
            <h1 className="text-2xl font-bold">Redefinir senha</h1>
            <p className="text-sm text-blue-100 mt-1">
              Utilize o codigo recebido e escolha uma nova senha segura.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {feedback.type === 'success' && (
              <div className="flex items-start p-4 border border-green-200 bg-green-50 text-green-700 rounded-lg">
                <FiCheckCircle className="mt-1 mr-3 flex-shrink-0" size={20} />
                <p className="text-sm">{feedback.message}</p>
              </div>
            )}

            {feedback.type === 'error' && (
              <div className="flex items-start p-4 border border-yellow-200 bg-yellow-50 text-yellow-700 rounded-lg">
                <FiAlertTriangle className="mt-1 mr-3 flex-shrink-0" size={20} />
                <p className="text-sm">{feedback.message}</p>
              </div>
            )}

            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                Codigo de verificacao
              </label>
              <input
                id="token"
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Cole aqui o codigo recebido"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </div>

            <div>
              <label htmlFor="nova-senha" className="block text-sm font-medium text-gray-700 mb-1">
                Nova senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="text-gray-400" />
                </div>
                <input
                  id="nova-senha"
                  type={showSenha ? 'text' : 'password'}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Digite a nova senha"
                  value={novaSenha}
                  onChange={(event) => setNovaSenha(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowSenha((prev) => !prev)}
                >
                  {showSenha ? (
                    <FiEyeOff className="text-gray-400 hover:text-gray-500" />
                  ) : (
                    <FiEye className="text-gray-400 hover:text-gray-500" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Recomendamos combinar letras maiusculas, minusculas, numeros e simbolos.
              </p>
            </div>

            <div>
              <label htmlFor="confirmacao" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar nova senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="text-gray-400" />
                </div>
                <input
                  id="confirmacao"
                  type={showConfirmacao ? 'text' : 'password'}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Repita a nova senha"
                  value={confirmacao}
                  onChange={(event) => setConfirmacao(event.target.value)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmacao((prev) => !prev)}
                >
                  {showConfirmacao ? (
                    <FiEyeOff className="text-gray-400 hover:text-gray-500" />
                  ) : (
                    <FiEye className="text-gray-400 hover:text-gray-500" />
                  )}
                </button>
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processando...
                </>
              ) : (
                'Atualizar senha'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
