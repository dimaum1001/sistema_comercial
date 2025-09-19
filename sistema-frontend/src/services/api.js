import axios from 'axios'

// Instância central de Axios utilizada por todo o frontend.
// Este wrapper injeta automaticamente o token JWT em cada requisição
// e trata respostas não autorizadas para manter a aplicação em estado consistente.
const api = axios.create({
  baseURL: 'http://localhost:8000',
})

// Adiciona o token antes de cada requisição, se existir no localStorage.
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

// Lida com respostas e erros globais. Em caso de 401 (não autorizado),
// remove o token salvo e dispara o evento `auth-changed` para atualizar o estado de login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
      window.dispatchEvent(new Event('auth-changed'))
    }
    return Promise.reject(error)
  },
)

export default api