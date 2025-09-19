import { useState, useEffect } from 'react'
import axios from '../services/api'
import { useNavigate, useParams } from 'react-router-dom'
import InputMask from 'react-input-mask'
import { 
  FiTruck, FiCreditCard, FiPhone, FiSave, FiArrowLeft, 
  FiHome, FiMapPin, FiGlobe, FiBriefcase 
} from 'react-icons/fi'
import axiosCep from 'axios'

export default function RegisterFornecedor() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    tipo_pessoa: 'J', // <- novo (F ou J)
    razao_social: '',
    nome_fantasia: '',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: {
      tipo_endereco: 'comercial',
      cep: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      pais: 'Brasil'
    }
  })

  const [loading, setLoading] = useState(false)
  const [mensagem, setMensagem] = useState({ texto: '', tipo: '' })

  // Se tiver id, busca dados do fornecedor
  useEffect(() => {
    if (id) {
      const fetchFornecedor = async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await axios.get(`/fornecedores/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          const fornecedor = response.data

          setFormData({
            tipo_pessoa: fornecedor.tipo_pessoa || 'J',
            razao_social: fornecedor.razao_social || '',
            // backend usa "nome" (nome fantasia). Mantemos seu campo nome_fantasia aqui
            nome_fantasia: fornecedor.nome || '',
            cnpj: fornecedor.cnpj_cpf || '',
            telefone: fornecedor.telefone || '',
            email: fornecedor.email || '',
            endereco: fornecedor.enderecos && fornecedor.enderecos.length > 0 ? {
              tipo_endereco: fornecedor.enderecos[0].tipo_endereco || 'comercial',
              cep: fornecedor.enderecos[0].cep || '',
              logradouro: fornecedor.enderecos[0].logradouro || '',
              numero: fornecedor.enderecos[0].numero || '',
              complemento: fornecedor.enderecos[0].complemento || '',
              bairro: fornecedor.enderecos[0].bairro || '',
              cidade: fornecedor.enderecos[0].cidade || '',
              estado: fornecedor.enderecos[0].estado || '',
              pais: fornecedor.enderecos[0].pais || 'Brasil'
            } : {
              tipo_endereco: 'comercial',
              cep: '',
              logradouro: '',
              numero: '',
              complemento: '',
              bairro: '',
              cidade: '',
              estado: '',
              pais: 'Brasil'
            }
          })
        } catch (err) {
          console.error('Erro ao carregar fornecedor:', err)
        }
      }
      fetchFornecedor()
    }
  }, [id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleEnderecoChange = (e) => {
    const { name, value } = e.target
    // força UF maiúsculo
    const val = name === 'estado' ? String(value).toUpperCase() : value

    setFormData(prev => ({
      ...prev,
      endereco: { ...prev.endereco, [name]: val }
    }))

    // 🔹 Consulta automática no ViaCEP
    if (name === "cep" && value.replace(/\D/g, "").length === 8) {
      axiosCep.get(`https://viacep.com.br/ws/${value.replace(/\D/g, "")}/json/`)
        .then(resp => {
          if (!resp.data.erro) {
            setFormData(prev => ({
              ...prev,
              endereco: {
                ...prev.endereco,
                logradouro: resp.data.logradouro || "",
                bairro: resp.data.bairro || "",
                cidade: resp.data.localidade || "",
                estado: (resp.data.uf || "").toUpperCase(),
                cep: value
              }
            }))
          }
        })
        .catch(err => console.error("Erro ao consultar CEP:", err))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensagem({ texto: '', tipo: '' })

    const doc = (formData.cnpj || '').replace(/\D/g, '')
    if (!formData.razao_social || !doc) {
      setMensagem({ 
        texto: 'Razão Social e documento (CNPJ/CPF) são obrigatórios', 
        tipo: 'erro' 
      })
      setLoading(false)
      return
    }

    // valida tamanho básico
    if (formData.tipo_pessoa === 'J' && doc.length !== 14) {
      setMensagem({ texto: 'CNPJ inválido', tipo: 'erro' })
      setLoading(false)
      return
    }
    if (formData.tipo_pessoa === 'F' && doc.length !== 11) {
      setMensagem({ texto: 'CPF inválido', tipo: 'erro' })
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      const payload = {
        // mapeamento para o backend
        tipo_pessoa: formData.tipo_pessoa,
        razao_social: (formData.razao_social || "").trim(),
        // backend aceita "nome" (alias para seu nome_fantasia no schema)
        nome: (formData.nome_fantasia || "").trim() || (formData.razao_social || "").trim(),
        cnpj_cpf: doc,
        telefone: formData.telefone?.replace(/\D/g, "") || null,
        email: formData.email?.trim() || null,
        enderecos: [formData.endereco]
      }

      if (id) {
        await axios.put(`/fornecedores/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setMensagem({ texto: 'Fornecedor atualizado com sucesso!', tipo: 'sucesso' })
      } else {
        await axios.post('/fornecedores', payload, {
          headers: { Authorization: `Bearer ${token}` }
        })
        setMensagem({ texto: 'Fornecedor cadastrado com sucesso!', tipo: 'sucesso' })
      }

      setTimeout(() => navigate('/fornecedores'), 1200)

    } catch (err) {
      console.error('Erro ao salvar fornecedor:', err)
      setMensagem({ 
        texto: err.response?.data?.detail || 'Erro ao salvar fornecedor', 
        tipo: 'erro' 
      })
    } finally {
      setLoading(false)
    }
  }

  // máscara dinâmica conforme tipo de pessoa
  const maskDocumento = formData.tipo_pessoa === 'F' ? '999.999.999-99' : '99.999.999/9999-99'
  const labelDocumento = formData.tipo_pessoa === 'F' ? 'CPF *' : 'CNPJ *'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-md overflow-hidden">
        
        {/* Cabeçalho */}
        <div className="bg-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/fornecedores')}
              className="text-white hover:text-blue-200 transition"
            >
              <FiArrowLeft size={20} />
            </button>
            <h2 className="text-xl font-bold flex items-center">
              <FiTruck className="mr-2" />
              {id ? "Editar Fornecedor" : "Cadastrar Fornecedor"}
            </h2>
            <div className="w-6"></div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {mensagem.texto && (
            <div className={`p-4 rounded-lg ${
              mensagem.tipo === 'sucesso' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}>
              {mensagem.texto}
            </div>
          )}

          {/* Tipo de Pessoa */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Pessoa *</label>
            <select
              name="tipo_pessoa"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.tipo_pessoa}
              onChange={handleChange}
              required
            >
              <option value="J">Jurídica</option>
              <option value="F">Física</option>
            </select>
          </div>

          {/* Razão Social */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
            <div className="relative">
              <FiBriefcase className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                name="razao_social"
                placeholder="Razão Social"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.razao_social}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Nome Fantasia */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
            <input
              type="text"
              name="nome_fantasia"
              placeholder="Nome Fantasia"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.nome_fantasia}
              onChange={handleChange}
            />
          </div>

          {/* Documento (CNPJ/CPF) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{labelDocumento}</label>
            <div className="relative">
              <FiCreditCard className="absolute left-3 top-3 text-gray-400" />
              <InputMask
                mask={maskDocumento}
                name="cnpj"
                placeholder={formData.tipo_pessoa === 'F' ? '000.000.000-00' : '00.000.000/0000-00'}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.cnpj}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <div className="relative">
              <FiPhone className="absolute left-3 top-3 text-gray-400" />
              <InputMask
                mask="(99) 99999-9999"
                name="telefone"
                placeholder="(00) 00000-0000"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.telefone}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              placeholder="fornecedor@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          {/* Endereço */}
          <h3 className="text-lg font-semibold text-gray-700 pt-2">Endereço</h3>

          {/* CEP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CEP *</label>
            <div className="relative">
              <FiMapPin className="absolute left-3 top-3 text-gray-400" />
              <InputMask
                mask="99999-999"
                name="cep"
                placeholder="00000-000"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.endereco.cep}
                onChange={handleEnderecoChange}
                required
              />
            </div>
          </div>

          {/* Logradouro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro *</label>
            <div className="relative">
              <FiHome className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                name="logradouro"
                placeholder="Rua, Avenida..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.endereco.logradouro}
                onChange={handleEnderecoChange}
                required
              />
            </div>
          </div>

          {/* Número e Complemento */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
              <input
                type="text"
                name="numero"
                placeholder="123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.endereco.numero}
                onChange={handleEnderecoChange}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
              <input
                type="text"
                name="complemento"
                placeholder="Apto, Bloco..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.endereco.complemento}
                onChange={handleEnderecoChange}
              />
            </div>
          </div>

          {/* Bairro */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
            <input
              type="text"
              name="bairro"
              placeholder="Bairro"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={formData.endereco.bairro}
              onChange={handleEnderecoChange}
            />
          </div>

          {/* Cidade e Estado */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade *</label>
              <input
                type="text"
                name="cidade"
                placeholder="Cidade"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.endereco.cidade}
                onChange={handleEnderecoChange}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado *</label>
              <input
                type="text"
                name="estado"
                placeholder="UF"
                maxLength={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 uppercase"
                value={formData.endereco.estado}
                onChange={handleEnderecoChange}
                required
              />
            </div>
          </div>

          {/* País */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">País</label>
            <div className="relative">
              <FiGlobe className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                name="pais"
                placeholder="Brasil"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.endereco.pais}
                onChange={handleEnderecoChange}
              />
            </div>
          </div>

          {/* Botões */}
          <div className="flex flex-col space-y-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className={`flex items-center justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                loading ? 'bg-green-500' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" />
                  {id ? "Atualizar Fornecedor" : "Cadastrar Fornecedor"}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/fornecedores')}
              className="py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FiArrowLeft className="inline mr-2" />
              Voltar para lista
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
