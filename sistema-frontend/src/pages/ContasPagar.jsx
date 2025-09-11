import React, { useEffect, useMemo, useState } from "react";
import api from "../services/api";

// Utilidades
const hojeISO = () => new Date().toISOString().slice(0, 10);
const somar = (arr, sel) =>
  arr.reduce((s, it) => s + (typeof sel === "function" ? sel(it) : Number(it[sel] || 0)), 0);

const fmtBRL = (n) =>
  (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toNumber2 = (v) => {
  const s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(".", "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};

const isVencida = (c) => {
  if (!c || c.status === "paga") return false;
  const hoje = new Date();
  const venc = new Date(c.data_vencimento);
  venc.setHours(0, 0, 0, 0);
  hoje.setHours(0, 0, 0, 0);
  return venc < hoje;
};

const formatarDataBR = (isoDate) => {
  if (!isoDate) return "—";
  const [ano, mes, dia] = isoDate.split("T")[0].split("-");
  return `${dia}/${mes}/${ano}`;
};


export default function ContasPagar() {
  const [fornecedores, setFornecedores] = useState([]);
  const [contas, setContas] = useState([]);

  // Filtros (1º e último dia do mês atual)
  const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const ultimoDia = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [periodo, setPeriodo] = useState({ inicio: primeiroDia, fim: ultimoDia });
  const [fornecedorFiltro, setFornecedorFiltro] = useState("");

  const [novaConta, setNovaConta] = useState({
    fornecedorId: "",
    descricao: "",
    valor: "",
    dataVencimento: ultimoDia,
  });

  const [editando, setEditando] = useState(null);

  const [msg, setMsg] = useState({ tipo: "", texto: "" });
  const notify = (tipo, texto) => setMsg({ tipo, texto });
  useEffect(() => {
    if (!msg.texto) return;
    const t = setTimeout(() => setMsg({ tipo: "", texto: "" }), 3500);
    return () => clearTimeout(t);
  }, [msg]);

  // Carrega dados
  useEffect(() => {
    (async () => {
      try {
        const [fRes, cRes] = await Promise.all([api.get("/fornecedores"), api.get("/contas-pagar")]);
        setFornecedores(fRes.data || []);
        setContas(cRes.data || []);
      } catch (e) {
        notify("erro", "Erro ao carregar dados.");
      }
    })();
  }, []);

  // Criação
  const handleChange = (e) => {
    setNovaConta((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  const criarConta = async () => {
    if (!novaConta.dataVencimento) return notify("erro", "Informe a data de vencimento.");
    const valor = toNumber2(novaConta.valor);
    if (valor <= 0) return notify("erro", "Valor deve ser maior que zero.");

    try {
      const payload = {
        fornecedor_id: novaConta.fornecedorId || null,
        descricao: novaConta.descricao || null,
        valor,
        data_vencimento: novaConta.dataVencimento,
      };
      const { data } = await api.post("/contas-pagar", payload);
      setContas((prev) => [data, ...prev]);
      setNovaConta({ fornecedorId: "", descricao: "", valor: "", dataVencimento: ultimoDia });
      notify("ok", "Conta criada com sucesso.");
    } catch (e) {
      notify("erro", e?.response?.data?.detail || "Erro ao criar conta.");
    }
  };

  // Atualizações
  const marcarComoPaga = async (id) => {
    try {
      const { data } = await api.put(`/contas-pagar/${id}`, {
        status: "paga",
        data_pagamento: new Date().toISOString(),
      });
      setContas((prev) => prev.map((c) => (c.id === id ? data : c)));
      notify("ok", "Conta marcada como paga.");
    } catch {
      notify("erro", "Erro ao marcar como paga.");
    }
  };

  const salvarEdicao = async () => {
    if (!editando) return;
    const valor = toNumber2(editando.valor);
    if (valor <= 0) return notify("erro", "Valor deve ser maior que zero.");
    try {
      const payload = {
        fornecedor_id: editando.fornecedor_id || null,
        descricao: editando.descricao || null,
        valor,
        data_vencimento: editando.data_vencimento,
        status: editando.status,
      };
      const { data } = await api.put(`/contas-pagar/${editando.id}`, payload);
      setContas((prev) => prev.map((c) => (c.id === data.id ? data : c)));
      setEditando(null);
      notify("ok", "Conta atualizada.");
    } catch {
      notify("erro", "Erro ao atualizar conta.");
    }
  };

  const excluirConta = async (id) => {
    if (!window.confirm("Deseja mesmo excluir esta conta?")) return;
    try {
      await api.delete(`/contas-pagar/${id}`);
      setContas((prev) => prev.filter((c) => c.id !== id));
      notify("ok", "Conta excluída.");
    } catch {
      notify("erro", "Erro ao excluir conta.");
    }
  };

  // Filtros
  const contasFiltradas = useMemo(() => {
    return (contas || [])
      .filter((c) => {
        if (filtroStatus !== "todas" && (c.status || "pendente") !== filtroStatus) return false;
        if (fornecedorFiltro && c.fornecedor_id !== fornecedorFiltro) return false;
        if (periodo.inicio && c.data_vencimento.slice(0, 10) < periodo.inicio) return false;
        if (periodo.fim && c.data_vencimento.slice(0, 10) > periodo.fim) return false;
        return true;
      })
      .sort((a, b) => new Date(a.data_vencimento) - new Date(b.data_vencimento));
  }, [contas, filtroStatus, fornecedorFiltro, periodo]);

  const totalPendente = useMemo(
    () => somar(contasFiltradas.filter((c) => (c.status || "pendente") === "pendente"), "valor"),
    [contasFiltradas]
  );
  const totalVencido = useMemo(
    () =>
      somar(
        contasFiltradas.filter((c) => (c.status || "pendente") === "pendente" && isVencida(c)),
        "valor"
      ),
    [contasFiltradas]
  );
  const totalPeriodo = useMemo(() => somar(contasFiltradas, "valor"), [contasFiltradas]);

  const nomeFornecedor = (id) =>
    fornecedores.find((f) => f.id === id)?.nome || "—";

  const StatusBadge = ({ status }) => {
    const s = (status || "pendente").toLowerCase();
    const cls =
      s === "paga"
        ? "bg-green-100 text-green-800 border-green-200"
        : "bg-amber-100 text-amber-800 border-amber-200";
    return (
      <span className={`px-2 py-0.5 text-xs border rounded ${cls}`}>
        {s === "paga" ? "Paga" : "Pendente"}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Contas a Pagar</h2>

      {msg.texto && (
        <div
          className={`mb-3 rounded px-3 py-2 text-sm ${
            msg.tipo === "ok" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {msg.texto}
        </div>
      )}

      {/* Resumos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-white border rounded p-3">
          <div className="text-xs text-gray-500">Total no período</div>
          <div className="text-lg font-semibold">{fmtBRL(totalPeriodo)}</div>
        </div>
        <div className="bg-white border rounded p-3">
          <div className="text-xs text-gray-500">Pendente</div>
          <div className="text-lg font-semibold">{fmtBRL(totalPendente)}</div>
        </div>
        <div className="bg-white border rounded p-3">
          <div className="text-xs text-gray-500">Vencido</div>
          <div className="text-lg font-semibold text-red-600">{fmtBRL(totalVencido)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border rounded p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Status</label>
            <select
              className="w-full p-2 border rounded text-sm"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="todas">Todas</option>
              <option value="pendente">Pendente</option>
              <option value="paga">Paga</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Fornecedor</label>
            <select
              className="w-full p-2 border rounded text-sm"
              value={fornecedorFiltro}
              onChange={(e) => setFornecedorFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Início</label>
            <input
              type="date"
              className="w-full p-2 border rounded text-sm"
              value={periodo.inicio}
              onChange={(e) => setPeriodo((p) => ({ ...p, inicio: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fim</label>
            <input
              type="date"
              className="w-full p-2 border rounded text-sm"
              value={periodo.fim}
              onChange={(e) => setPeriodo((p) => ({ ...p, fim: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Nova Conta */}
      <div className="bg-white border rounded p-3 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs text-gray-600 mb-1">Fornecedor</label>
            <select
              name="fornecedorId"
              value={novaConta.fornecedorId}
              onChange={handleChange}
              className="w-full p-2 border rounded text-sm"
            >
              <option value="">Conta avulsa (sem fornecedor)</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Valor (R$)</label>
            <input
              type="text"
              name="valor"
              value={novaConta.valor}
              onChange={handleChange}
              placeholder="0,00"
              className="w-full p-2 border rounded text-sm text-right"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Vencimento</label>
            <input
              type="date"
              name="dataVencimento"
              value={novaConta.dataVencimento}
              onChange={handleChange}
              className="w-full p-2 border rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Descrição</label>
            <input
              type="text"
              name="descricao"
              value={novaConta.descricao}
              onChange={handleChange}
              placeholder="Ex.: Energia, Internet…"
              className="w-full p-2 border rounded text-sm"
            />
          </div>
          <div className="md:col-span-5 flex justify-end">
            <button
              onClick={criarConta}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              Criar conta
            </button>
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white border rounded overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">Vencimento</th>
              <th className="px-3 py-2 text-left">Fornecedor</th>
              <th className="px-3 py-2 text-left">Descrição</th>
              <th className="px-3 py-2 text-right">Valor</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Pagamento</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {contasFiltradas.map((c) => {
              const vencida = isVencida(c);
              if (editando?.id === c.id) {
                return (
                  <tr key={c.id} className={vencida ? "bg-red-50" : ""}>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={editando.data_vencimento?.slice(0, 10) || ""}
                        onChange={(e) =>
                          setEditando((s) => ({ ...s, data_vencimento: e.target.value }))
                        }
                        className="p-1 border rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="p-1 border rounded text-sm"
                        value={editando.fornecedor_id || ""}
                        onChange={(e) =>
                          setEditando((s) => ({ ...s, fornecedor_id: e.target.value }))
                        }
                      >
                        <option value="">Conta avulsa</option>
                        {fornecedores.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nome}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        className="p-1 border rounded w-full text-sm"
                        value={editando.descricao || ""}
                        onChange={(e) =>
                          setEditando((s) => ({ ...s, descricao: e.target.value }))
                        }
                      />
                    </td>

                    <td className="px-3 py-2 text-right">
                      <input
                        type="text"
                        className="p-1 border rounded text-right text-sm"
                        value={String(editando.valor)}
                        onChange={(e) => setEditando((s) => ({ ...s, valor: e.target.value }))}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={editando.status} />
                    </td>
                    <td className="px-3 py-2">
                      {editando.data_pagamento
                        ? new Date(editando.data_pagamento).toLocaleDateString("pt-BR")
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right space-x-2">
                      <button
                        onClick={salvarEdicao}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="px-2 py-1 text-xs bg-gray-300 rounded"
                      >
                        Cancelar
                      </button>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={c.id} className={vencida ? "bg-red-50" : ""}>
                  <td className="px-3 py-2">
                    {formatarDataBR(c.data_vencimento)}
                  </td>
                  <td className="px-3 py-2">
                    {nomeFornecedor(c.fornecedor_id)}
                  </td>
                  <td className="px-3 py-2">
                    {c.descricao || "—"}
                  </td>
                  <td className="px-3 py-2 text-right">{fmtBRL(c.valor)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-2">
                    {c.data_pagamento
                      ? new Date(c.data_pagamento).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right space-x-2">
                    {c.status !== "paga" && (
                      <button
                        onClick={() => marcarComoPaga(c.id)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                      >
                        Marcar como paga
                      </button>
                    )}
                    <button
                      onClick={() => setEditando({ ...c })}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => excluirConta(c.id)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
            {contasFiltradas.length === 0 && (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={6}>
                  Nenhuma conta encontrada com os filtros atuais.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
