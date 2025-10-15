import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMail, FiArrowLeft, FiCheckCircle, FiAlertTriangle } from 'react-icons/fi'
import axios from '../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [feedback, setFeedback] = useState({ type: null, message: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setFeedback({ type: null, message: '' })

    try {
      await axios.post('/auth/forgot-password', { email })
      setFeedback({
        type: 'success',
        message:
          'Se o e-mail estiver cadastrado, voce recebera um link para redefinir a senha em instantes.',
      })
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        'Nao foi possivel registrar o pedido. Tente novamente em alguns minutos.'
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
            <FiArrowLeft className="mr-2" />
            Voltar para login
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
            <h1 className="text-2xl font-bold">Recuperar acesso</h1>
            <p className="text-sm text-blue-100 mt-1">
              Informe seu e-mail para receber orientacoes seguras de redefinicao de senha.
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
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail cadastrado
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiMail className="text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
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
                  Enviando...
                </>
              ) : (
                'Enviar e-mail de redefinicao'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
