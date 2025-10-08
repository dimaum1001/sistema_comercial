// src/services/api.js
import axios from 'axios'

// Base URL via .env (fallback para localhost)
const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:8000',
})

// Inject JWT em todas as requisições
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

// Logout “inteligente”: só desloga em 401 de /auth/me|/auth/login|/auth/refresh
function hardLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('usuario')
  window.dispatchEvent(new Event('auth-changed'))
  // redireciona para login; se preferir não redirecionar aqui, remova a linha abaixo
  window.location.href = '/login'
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status
    const url = String(error?.config?.url || '')

    if (status === 401) {
      const isAuthEndpoint =
        /\/auth\/(me|login|refresh)\b/i.test(url)

      if (isAuthEndpoint) {
        hardLogout()
        // não retorna Promise.reject, pois já redirecionou; mas para manter o padrão:
        return Promise.reject(error)
      }

      // Para 401 de outras rotas (ex.: /auditoria/acessos),
      // NÃO apagar token aqui — deixa o componente tratar (exibir mensagem).
      return Promise.reject(error)
    }

    // 403 não deve derrubar a sessão — componente trata acesso negado
    return Promise.reject(error)
  },
)

export default api
