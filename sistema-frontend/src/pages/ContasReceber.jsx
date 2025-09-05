import { useEffect, useState } from "react";
import api from "../services/api";
import { FiCheckCircle, FiTrash2 } from "react-icons/fi";

export default function ContasReceber() {
  const [pagamentos, setPagamentos] = useState([]);

  useEffect(() => {
    carregarPagamentos();
  }, []);

  async function carregarPagamentos() {
    try {
      const resp = await api.get("/pagamentos/pendentes");
      setPagamentos(resp.data);
    } catch (err) {
      console.error("Erro ao carregar pagamentos:", err);
    }
  }

  async function darBaixa(id) {
    try {
      await api.put(`/pagamentos/${id}`, { status: "pago" });
      carregarPagamentos();
    } catch (err) {
      console.error("Erro ao dar baixa:", err);
    }
  }

  async function excluirPagamento(id) {
    try {
      await api.delete(`/pagamentos/${id}`);
      carregarPagamentos();
    } catch (err) {
      console.error("Erro ao excluir pagamento:", err);
    }
  }

  return (
    <div className="max-w-5xl mx-auto bg-white shadow p-6 rounded-lg">
      <h1 className="text-xl font-bold mb-4">📑 Contas a Receber</h1>

      <table className="w-full border">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-2 text-left">Cliente</th>
            <th className="px-4 py-2 text-left">Forma</th>
            <th className="px-4 py-2 text-left">Valor</th>
            <th className="px-4 py-2 text-left">Vencimento</th>
            <th className="px-4 py-2 text-left">Parcela</th>
            <th className="px-4 py-2 text-left">Ações</th>
          </tr>
        </thead>
        <tbody>
          {pagamentos.length === 0 ? (
            <tr>
              <td colSpan="6" className="text-center py-4 text-gray-500">
                Nenhum pagamento pendente
              </td>
            </tr>
          ) : (
            pagamentos.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="px-4 py-2">{p.venda?.cliente?.nome || "-"}</td>
                <td className="px-4 py-2">{p.forma_pagamento}</td>
                <td className="px-4 py-2">R$ {Number(p.valor).toFixed(2)}</td>
                <td className="px-4 py-2">
                  {p.data_vencimento
                    ? new Date(p.data_vencimento).toLocaleDateString("pt-BR")
                    : "-"}
                </td>
                <td className="px-4 py-2">
                  {p.parcela_numero
                    ? `${p.parcela_numero}/${p.parcela_total}`
                    : "-"}
                </td>
                <td className="px-4 py-2 flex gap-2">
                  <button
                    onClick={() => darBaixa(p.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    <FiCheckCircle /> Baixar
                  </button>
                  <button
                    onClick={() => excluirPagamento(p.id)}
                    className="flex items-center gap-1 px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    <FiTrash2 /> Excluir
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
