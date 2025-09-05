import { useState, useEffect } from "react";
import api from "../services/api";
import {
  FiBox,
  FiSave,
  FiList,
} from "react-icons/fi";

export default function MovimentosEstoque() {
  const [produtos, setProdutos] = useState([]);
  const [movimentos, setMovimentos] = useState([]);
  const [produtoId, setProdutoId] = useState("");
  const [tipo, setTipo] = useState("entrada");
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    carregarProdutos();
    carregarMovimentos();
  }, []);

  async function carregarProdutos() {
    try {
      const resp = await api.get("/produtos/", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProdutos(resp.data);
    } catch (err) {
      console.error("Erro ao carregar produtos", err);
      setMensagem({ texto: "Erro ao carregar produtos", tipo: "erro" });
    }
  }

  async function carregarMovimentos() {
    try {
      const resp = await api.get("/estoque/movimentos", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMovimentos(resp.data);
    } catch (err) {
      console.error("Erro ao carregar movimentos", err);
      setMensagem({
        texto: "Erro ao carregar histórico de estoque",
        tipo: "erro",
      });
    }
  }

  async function salvarMovimento(e) {
    e.preventDefault();

    if (!produtoId || quantidade <= 0) {
      setMensagem({
        texto: "Selecione um produto e informe a quantidade",
        tipo: "erro",
      });
      return;
    }

    setLoading(true);
    try {
      await api.post(
        "/estoque/movimentar",
        {
          produto_id: produtoId,
          tipo,
          quantidade: Number(quantidade),
          observacao,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMensagem({
        texto: "Movimentação registrada com sucesso!",
        tipo: "sucesso",
      });
      setProdutoId("");
      setTipo("entrada");
      setQuantidade(1);
      setObservacao("");
      carregarMovimentos();
      carregarProdutos();
    } catch (err) {
      console.error("Erro ao registrar movimentação", err);
      const errorMsg =
        err.response?.data?.detail || "Erro ao registrar movimentação";
      setMensagem({ texto: errorMsg, tipo: "erro" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-sm p-6">
        {/* Cabeçalho */}
        <h1 className="text-2xl font-bold text-gray-800 flex items-center mb-6">
          <FiBox className="mr-2" />
          Movimentações de Estoque
        </h1>

        {/* Mensagem */}
        {mensagem.texto && (
          <div
            className={`mb-4 p-3 rounded-lg ${
              mensagem.tipo === "sucesso"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        {/* Formulário de Movimentação */}
        <form
          onSubmit={salvarMovimento}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
        >
          {/* Produto */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produto*
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={produtoId}
              onChange={(e) => setProdutoId(e.target.value)}
              required
            >
              <option value="">Selecione um produto</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome} - Estoque atual: {p.estoque}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Movimento*
            </label>
            <select
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              required
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste</option>
            </select>
          </div>

          {/* Quantidade */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade*
            </label>
            <input
              type="number"
              min="1"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              required
            />
          </div>

          {/* Observação */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observação
            </label>
            <input
              type="text"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Compra fornecedor X"
            />
          </div>

          {/* Botão */}
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-60"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" />
                  Registrar
                </>
              )}
            </button>
          </div>
        </form>

        {/* Histórico de Movimentos */}
        <h2 className="text-lg font-semibold mb-4 flex items-center">
          <FiList className="mr-2" />
          Histórico de Movimentações
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Produto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fornecedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Observação
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {movimentos.map((m) => (
                <tr key={m.id}>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(m.data_movimento).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {m.produto?.nome || "Produto removido"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.produto?.fornecedor?.nome || "-"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 capitalize">
                    {m.tipo}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.quantidade}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {m.observacao || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
