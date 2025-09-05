import { useState, useEffect } from "react";
import api from "../services/api";
import { FiDollarSign, FiSave, FiTrash2 } from "react-icons/fi";

export default function PrecosProdutos() {
  const [produtos, setProdutos] = useState([]);
  const [precos, setPrecos] = useState([]);
  const [produtoId, setProdutoId] = useState("");
  const [preco, setPreco] = useState("");

  useEffect(() => {
    carregarProdutos();
    carregarPrecos();
  }, []);

  async function carregarProdutos() {
    const resp = await api.get("/produtos");
    setProdutos(resp.data);
  }

  async function carregarPrecos() {
  const resp = await api.get("/precos");

  // 🔹 Ordena do mais antigo para o mais novo (garante que o último é o atual)
  const ordenados = resp.data.sort(
    (a, b) => new Date(a.data_inicio) - new Date(b.data_inicio)
  );

  // 🔹 Mantém só o último preço de cada produto
  const ultimosPrecos = Object.values(
    ordenados.reduce((acc, preco) => {
      acc[preco.produto_id] = preco;
      return acc;
    }, {})
  );

  setPrecos(ultimosPrecos);
}


  async function salvarPreco() {
    if (!produtoId || !preco) return;
    try {
      await api.post("/precos", {
        produto_id: produtoId,
        preco: Number(preco),
      });
      setPreco("");
      setProdutoId("");
      carregarPrecos();
    } catch (err) {
      console.error("Erro ao salvar preço", err);
    }
  }

  async function excluirPreco(id) {
    try {
      await api.delete(`/precos/${id}`);
      carregarPrecos();
    } catch (err) {
      console.error("Erro ao excluir preço", err);
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-white shadow p-6 rounded-lg">
      <h1 className="text-xl font-bold mb-4 flex items-center">
        <FiDollarSign className="mr-2" /> Gerenciar Preços de Produtos
      </h1>

      <div className="flex gap-4 mb-6">
        <select
          className="flex-1 border p-2 rounded"
          value={produtoId}
          onChange={(e) => setProdutoId(e.target.value)}
        >
          <option value="">Selecione um produto</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="w-40 border p-2 rounded"
          placeholder="Preço"
          value={preco}
          onChange={(e) => setPreco(e.target.value)}
        />
        <button
          onClick={salvarPreco}
          className="bg-green-600 text-white px-4 py-2 rounded flex items-center"
        >
          <FiSave className="mr-1" /> Salvar
        </button>
      </div>

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Produto</th>
            <th className="px-4 py-2 text-left">Preço</th>
            <th className="px-4 py-2 text-left">Ativo</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {precos.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="px-4 py-2">{p.produto?.nome}</td>
              <td className="px-4 py-2">R$ {Number(p.preco).toFixed(2)}</td>
              <td className="px-4 py-2">{p.ativo ? "Sim" : "Não"}</td>
              <td className="px-4 py-2">
                <button
                  onClick={() => excluirPreco(p.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <FiTrash2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
