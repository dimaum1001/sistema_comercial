import { useEffect, useState } from "react";
import { FiPlus, FiTrash2, FiRefreshCcw } from "react-icons/fi";
import api from "../services/api";

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return ["true", "1", "sim", "s"].includes(value.toLowerCase());
  }
  return Boolean(value);
}

export default function Unidades() {
  const [unidades, setUnidades] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removendoId, setRemovendoId] = useState(null);
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });
  const [form, setForm] = useState({
    nome: "",
    sigla: "",
    permite_decimal: true,
  });

  async function carregarUnidades(showSpinner = true) {
    if (showSpinner) setListLoading(true);
    try {
      const response = await api.get("/unidades-medida");
      const lista = Array.isArray(response.data) ? response.data : response.data?.items || [];
      setUnidades(lista);
    } catch (error) {
      console.error("Erro ao carregar unidades:", error);
      setMensagem({
        texto: error?.response?.data?.detail || "Erro ao carregar unidades de medida.",
        tipo: "erro",
      });
    } finally {
      if (showSpinner) setListLoading(false);
    }
  }

  useEffect(() => {
    carregarUnidades();
  }, []);

  const handleChange = (campo, valor) => {
    setForm((prev) => ({
      ...prev,
      [campo]: campo === "permite_decimal" ? toBoolean(valor) : valor,
    }));
  };

  const resetMensagem = () => setMensagem({ texto: "", tipo: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    resetMensagem();

    const nome = form.nome.trim();
    const sigla = form.sigla.trim().toUpperCase();

    if (!nome || !sigla) {
      setMensagem({ texto: "Informe nome e sigla da unidade.", tipo: "erro" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nome,
        sigla,
        permite_decimal: Boolean(form.permite_decimal),
      };
      const response = await api.post("/unidades-medida", payload);
      const criada = response.data;
      setUnidades((prev) => [criada, ...prev]);
      setForm({ nome: "", sigla: "", permite_decimal: true });
      setMensagem({ texto: "Unidade criada com sucesso.", tipo: "sucesso" });
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        (error?.response?.status === 409
          ? "Já existe uma unidade com essa sigla."
          : "Erro ao cadastrar unidade.");
      setMensagem({ texto: detail, tipo: "erro" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const unidade = unidades.find((u) => u.id === id);
    if (!unidade) return;

    const confirmado = window.confirm(
      `Deseja remover a unidade "${unidade.sigla} - ${unidade.nome}"? Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;

    resetMensagem();
    setRemovendoId(id);
    try {
      await api.delete(`/unidades-medida/${id}`);
      setUnidades((prev) => prev.filter((u) => u.id !== id));
      setMensagem({ texto: "Unidade removida com sucesso.", tipo: "sucesso" });
    } catch (error) {
      const detail =
        error?.response?.data?.detail ||
        (error?.response?.status === 400
          ? "Não é possível remover: existem produtos associados a esta unidade."
          : "Erro ao remover unidade.");
      setMensagem({ texto: detail, tipo: "erro" });
    } finally {
      setRemovendoId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <FiPlus className="text-lg text-green-600" />
            Gerenciar Unidades de Medida
          </h1>
          <button
            type="button"
            onClick={() => carregarUnidades(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-gray-300 hover:bg-gray-100 transition disabled:opacity-60"
            disabled={listLoading || saving || removendoId !== null}
          >
            <FiRefreshCcw />
            Atualizar
          </button>
        </div>

        {mensagem.texto && (
          <div
            className={`mx-6 mt-6 px-4 py-3 rounded-md text-sm ${
              mensagem.tipo === "sucesso"
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {mensagem.texto}
          </div>
        )}

        <div className="p-6 border-b border-gray-200">
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-700 mb-1">Nome da Unidade*</label>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => handleChange("nome", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Quilograma, Caixa, Unidade"
                required
              />
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Sigla*</label>
              <input
                type="text"
                value={form.sigla}
                onChange={(e) => handleChange("sigla", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="KG, CX, UN"
                maxLength={10}
                required
              />
            </div>

            <div className="md:col-span-3 flex items-center gap-2">
              <input
                id="permite-decimal"
                type="checkbox"
                checked={Boolean(form.permite_decimal)}
                onChange={(e) => handleChange("permite_decimal", e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="permite-decimal" className="text-sm text-gray-700">
                Permite valores decimais (ex.: pesos, metros)
              </label>
            </div>

            <div className="md:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700 transition disabled:opacity-60"
              >
                {saving ? "Salvando..." : <> <FiPlus /> Salvar Unidade </>}
              </button>
            </div>
          </form>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Unidades cadastradas</h2>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Sigla</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Nome</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Permite decimal</th>
                  <th className="px-4 py-2 text-left text-gray-600 font-medium">Criado em</th>
                  <th className="px-4 py-2 text-right text-gray-600 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Carregando unidades...
                    </td>
                  </tr>
                ) : unidades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      Nenhuma unidade cadastrada até o momento.
                    </td>
                  </tr>
                ) : (
                  unidades.map((u) => (
                    <tr key={u.id} className="border-t">
                      <td className="px-4 py-2 font-semibold text-gray-800">{u.sigla}</td>
                      <td className="px-4 py-2 text-gray-700">{u.nome}</td>
                      <td className="px-4 py-2 text-gray-700">
                        {u.permite_decimal ? "Sim" : "Não"}
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {u.criado_em
                          ? new Date(u.criado_em).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(u.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-60"
                          disabled={removendoId === u.id}
                          title="Remover unidade"
                        >
                          <FiTrash2 />
                          {removendoId === u.id ? "Removendo..." : "Excluir"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
