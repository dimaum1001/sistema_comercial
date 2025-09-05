import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "../services/api";
import { 
  FiPlus, FiEdit2, FiTrash2, FiSearch, 
  FiBox
} from "react-icons/fi";

const Produtos = () => {
  const navigate = useNavigate();
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });

  // Buscar produtos na API
  const fetchProdutos = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/produtos", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setProdutos(res.data);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      setMensagem({ 
        texto: "Erro ao carregar produtos", 
        tipo: "erro" 
      });
    } finally {
      setLoading(false);
    }
  };

  // Deletar produto
  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        const token = localStorage.getItem("token");
        await axios.delete(`/produtos/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setMensagem({
          texto: "Produto excluído com sucesso",
          tipo: "sucesso"
        });
        fetchProdutos();
      } catch (error) {
        console.error("Erro ao excluir produto:", error);
        setMensagem({
          texto: "Erro ao excluir produto",
          tipo: "erro"
        });
      }
    }
  };

  useEffect(() => {
    fetchProdutos();
  }, []);

  // Filtrar produtos (inclui fornecedor)
  const filteredProdutos = produtos.filter(produto =>
    produto.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.categoria?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.marca?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.codigo_barras?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    produto.fornecedor?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center">
            <FiBox className="mr-2" />
            Gerenciamento de Produtos
          </h1>
          <div className="flex space-x-3 mt-3 md:mt-0">
            <button
              onClick={() => navigate("/produtos/novo")}
              className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <FiPlus className="mr-1" />
              Novo Produto
            </button>
          </div>
        </div>

        {/* Mensagens */}
        {mensagem.texto && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              mensagem.tipo === "sucesso"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        {/* Barra de pesquisa */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Pesquisar por nome, categoria, fornecedor, marca ou código..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tabela de produtos */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredProdutos.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow-sm text-center">
            <p className="text-gray-600 mb-4">
              {searchTerm 
                ? "Nenhum produto encontrado para sua pesquisa." 
                : "Nenhum produto cadastrado ainda."}
            </p>
            <button
              onClick={() => navigate("/produtos/novo")}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              Cadastrar Primeiro Produto
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código Barras</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Custo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Preço Venda</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unidade</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Marca</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Localização</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cadastrado em</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Atualizado em</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProdutos.map((produto) => (
                    <tr key={produto.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-4 text-sm text-gray-500">{produto.codigo_barras || "-"}</td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">{produto.nome}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">{produto.fornecedor?.nome || "-"}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {produto.custo ? `R$ ${Number(produto.custo).toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {produto.preco_venda ? `R$ ${Number(produto.preco_venda).toFixed(2)}` : "-"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          produto.estoque > 10 
                            ? "bg-green-100 text-green-800"
                            : produto.estoque > 0
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {produto.estoque ?? 0} un.
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">{produto.unidade || "-"}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">{produto.categoria?.nome || "-"}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">{produto.marca || "-"}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">{produto.localizacao || "-"}</td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {produto.criado_em ? new Date(produto.criado_em).toLocaleDateString("pt-BR") : "-"}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        {produto.atualizado_em ? new Date(produto.atualizado_em).toLocaleDateString("pt-BR") : "-"}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => navigate(`/produtos/editar/${produto.id}`)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition"
                            title="Editar"
                          >
                            <FiEdit2 />
                          </button>
                          <button
                            onClick={() => navigate(`/produtos/editar/=${produto.id}`)}
                            className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 transition"
                            title="Gerenciar Preço"
                          >
                            💲
                          </button>
                          <button
                            onClick={() => handleDelete(produto.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition"
                            title="Excluir"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Produtos;
