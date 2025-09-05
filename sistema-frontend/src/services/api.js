import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000', // <- CORRETO com base na sua imagem
})

export default api