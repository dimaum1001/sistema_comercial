import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiX, FiCreditCard } from "react-icons/fi";
import api from "../services/api";

import { Page, Card } from "../components/ui";
import { classNames } from "../utils/classNames";

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
  if (!isoDate) return "--";
  const [ano, mes, dia] = isoDate.split("T")[0].split("-");
  return `${dia}/${mes}/${ano}`;
};

const maskDocumento = (valor) => {
  if (!valor) return '';
  const digits = String(valor).replace(/[^0-9]/g, '');
  if (digits.length === 11) return `***.***.***-${digits.slice(-2)}`;
  if (digits.length === 14) return `**.***.***/****-${digits.slice(-2)}`;
  if (digits.length > 4) {
    const masked = '*'.repeat(digits.length - 4);
    return `${masked}${digits.slice(-4)}`;
  }
  return '*'.repeat(Math.max(0, digits.length - 1)) + digits.slice(-1);
};

const formatFornecedorLabel = (fornecedor) => {
  if (!fornecedor) return '';
  const nomeBase = fornecedor.nome || fornecedor.razao_social || 'Sem nome';
  const doc = maskDocumento(fornecedor.cnpj_cpf);
  return doc ? `${nomeBase} (${doc})` : nomeBase;
};

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

function AsyncSearchBox({
  entity,
  placeholder,
  formatOption,
  onSelect,
  extraParams = {},
  minLen = 2,
  initialValue = '',
  rightSlot = null,
  clearOnSelect = true,
  onClear = () => {},
}) {
  const [term, setTerm] = useState(initialValue);
  const debounced = useDebouncedValue(term, 300);

  const [results, setResults] = useState([]);
  const resultsRef = useRef([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const listRef = useRef(null);
  const blurTimer = useRef(null);

  useEffect(() => {
    setTerm(initialValue);
  }, [initialValue]);

  const fetchResults = useCallback(
    async (reset = false) => {
      const q = debounced.trim();
      if (!reset && q.length < minLen && q.length !== 0) {
        setResults([]);
        resultsRef.current = [];
        setHasMore(false);
        setOpen(false);
        return;
      }
      if (q.length === 0 && minLen > 0 && reset) {
        setResults([]);
        resultsRef.current = [];
        setHasMore(false);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const params = {
          page: reset ? 1 : page,
          limit: 10,
          per_page: 10,
          ...extraParams,
        };
        params.offset = reset ? 0 : (page - 1) * params.limit;
        if (q.length >= minLen) {
          params.q = q;
          params.search = q;
          params.term = q;
          params.nome = q;
        }
        const resp = await api.get(`/${entity}`, { params });
        const hdrTotal =
          Number(resp?.headers?.['x-total-count']) ||
          Number((resp?.headers || {})['x-items-count']) ||
          null;

        const items = Array.isArray(resp.data) ? resp.data : resp.data?.items || [];
        const nextResults = reset ? items : [...resultsRef.current, ...items];
        resultsRef.current = nextResults;
        setResults(nextResults);

        const fetched = nextResults.length;
        const total = hdrTotal ?? fetched;
        const more = hdrTotal != null ? total > fetched : items.length === params.limit;
        setHasMore(more);

        setOpen(true);
      } catch {
        if (reset) {
          setResults([]);
          resultsRef.current = [];
          setOpen(false);
        }
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [debounced, entity, extraParams, minLen, page]
  );

  useEffect(() => {
    setPage(1);
    setHighlight(0);
    fetchResults(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  useEffect(() => {
    if (page > 1) fetchResults(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const clearAll = () => {
    setTerm('');
    setResults([]);
    resultsRef.current = [];
    setOpen(false);
    setPage(1);
    setHighlight(0);
    onClear();
  };

  const handleSelect = (item) => {
    if (item) {
      onSelect(item);
      if (clearOnSelect) {
        clearAll();
      } else {
        const formatted = formatOption ? formatOption(item) : '';
        setTerm(formatted);
        setOpen(false);
      }
    } else {
      onSelect(null);
      clearAll();
    }
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((prev) => Math.min(prev + 1, results.length - 1));
      scrollIntoView(highlight + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((prev) => Math.max(prev - 1, 0));
      scrollIntoView(highlight - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[highlight];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const scrollIntoView = (idx) => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[idx];
    if (el) el.scrollIntoView({ block: 'nearest' });
  };

  const onBlur = () => {
    blurTimer.current = setTimeout(() => setOpen(false), 120);
  };

  const onFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    if (results.length > 0) setOpen(true);
  };

  const loadMore = () => {
    if (hasMore) setPage((prev) => prev + 1);
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <input
            type="text"
            className="w-full text-sm p-2 pr-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder={placeholder}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onFocus={onFocus}
          />
          {term && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearAll}
              title="Limpar"
            >
              <FiX />
            </button>
          )}
        </div>
        {rightSlot}
      </div>
      {open && (
        <div
          className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto"
          ref={listRef}
        >
          {loading ? (
            <div className="p-3 text-xs text-gray-500">Carregando...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-gray-500">Nenhum resultado</div>
          ) : (
            results.map((item, idx) => (
              <button
                key={item.id || idx}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm ${idx === highlight ? 'bg-blue-50' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(item)}
              >
                {formatOption ? formatOption(item) : item.nome || item.razao_social || 'Sem nome'}
              </button>
            ))
          )}
          {hasMore && !loading && (
            <button
              type="button"
              className="w-full px-3 py-2 text-xs text-blue-600 hover:bg-blue-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={loadMore}
            >
              Carregar mais
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const FornecedorSearchBox = ({ formatOption = formatFornecedorLabel, ...props }) => (
  <AsyncSearchBox entity="fornecedores" formatOption={formatOption} {...props} />
);


export default function ContasPagar() {
  const [fornecedores, setFornecedores] = useState([]);
  const [contas, setContas] = useState([]);

  // Filtros (1o e ultimo dia do mes atual)
  const primeiroDia = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const ultimoDia = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [filtroStatus, setFiltroStatus] = useState("todas");
  const [periodo, setPeriodo] = useState({ inicio: primeiroDia, fim: ultimoDia });
  const [fornecedorFiltro, setFornecedorFiltro] = useState("");
  const [fornecedorFiltroNome, setFornecedorFiltroNome] = useState("");
  const [tabelaPageSize, setTabelaPageSize] = useState(10);
  const [tabelaPage, setTabelaPage] = useState(1);

  const [novaConta, setNovaConta] = useState({
    fornecedorId: "",
    fornecedorNome: "",
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
    const fetchData = async () => {
      try {
        const contasPromise = api.get("/contas-pagar");
        const fornecedoresPromise = (async () => {
          const chunk = 200;
          let offset = 0;
          let acumulado = [];
          for (let guard = 0; guard < 200; guard += 1) {
            const resp = await api.get("/fornecedores", { params: { offset, limit: chunk } });
            const arr = Array.isArray(resp.data) ? resp.data : resp.data?.items || [];
            acumulado = acumulado.concat(arr);
            if (arr.length < chunk) break;
            offset += chunk;
          }
          return acumulado;
        })();

        const [listaFornecedores, contasRes] = await Promise.all([fornecedoresPromise, contasPromise]);
        setFornecedores(listaFornecedores);
        setContas(contasRes.data || []);
      } catch (e) {
        notify("erro", "Erro ao carregar dados.");
      }
    };

    fetchData();
  }, []);

  // Criacao
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
      setNovaConta({ fornecedorId: "", fornecedorNome: "", descricao: "", valor: "", dataVencimento: ultimoDia });
      notify("ok", "Conta criada com sucesso.");
    } catch (e) {
      notify("erro", e?.response?.data?.detail || "Erro ao criar conta.");
    }
  };

  // Atualizacoes
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
      notify("ok", "Conta excluida.");
    } catch {
      notify("erro", "Erro ao excluir conta.");
    }
  };

  // Filtros
  const contasFiltradas = useMemo(() => {
    return (contas || [])
      .filter((c) => {
        if (filtroStatus !== "todas" && (c.status || "pendente") !== filtroStatus) return false;
        if (fornecedorFiltro && String(c.fornecedor_id) !== String(fornecedorFiltro)) return false;
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
  useEffect(() => {
    setTabelaPage(1);
  }, [filtroStatus, fornecedorFiltro, periodo]);

  const totalPaginas = useMemo(() => Math.max(1, Math.ceil((contasFiltradas.length || 0) / tabelaPageSize)), [contasFiltradas, tabelaPageSize]);

  useEffect(() => {
    if (tabelaPage > totalPaginas) {
      setTabelaPage(totalPaginas);
    }
  }, [tabelaPage, totalPaginas]);

  const contasPaginadas = useMemo(() => {
    const start = (tabelaPage - 1) * tabelaPageSize;
    return contasFiltradas.slice(start, start + tabelaPageSize);
  }, [contasFiltradas, tabelaPage, tabelaPageSize]);

  const nomeFornecedor = (id) => {
    const found = fornecedores.find((f) => f.id === id);
    return found ? formatFornecedorLabel(found) : '';
  };

  const upsertFornecedor = (registro) => {
    if (!registro || !registro.id) return;
    setFornecedores((prev) => {
      const exists = prev.some((item) => item.id === registro.id);
      if (exists) {
        return prev.map((item) => (item.id === registro.id ? { ...item, ...registro } : item));
      }
      return [...prev, registro];
    });
  };

  const handleTabelaPageSizeChange = (e) => {
    const novo = Number(e.target.value) || 10;
    setTabelaPageSize(novo);
    setTabelaPage(1);
  };

  const handleTabelaPrev = () => {
    setTabelaPage((prev) => Math.max(1, prev - 1));
  };

  const handleTabelaNext = () => {
    setTabelaPage((prev) => Math.min(totalPaginas, prev + 1));
  };

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

  const messageTone =
    msg?.tipo === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : msg?.tipo === "erro"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <Page
      title="Contas a Pagar"
      subtitle="Controle despesas, filtre por periodo e acompanhe pagamentos."
      icon={<FiCreditCard className="h-5 w-5" />}
    >
      {msg.texto && (
        <Card className={classNames('text-sm', messageTone)}>
          {msg.texto}
        </Card>
      )}

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Card padding="p-4">
            <div className="text-xs text-gray-500">Total no periodo</div>
            <div className="text-lg font-semibold">{fmtBRL(totalPeriodo)}</div>
          </Card>
          <Card padding="p-4">
            <div className="text-xs text-gray-500">Pendente</div>
            <div className="text-lg font-semibold">{fmtBRL(totalPendente)}</div>
          </Card>
          <Card padding="p-4">
            <div className="text-xs text-gray-500">Vencido</div>
            <div className="text-lg font-semibold text-red-600">{fmtBRL(totalVencido)}</div>
          </Card>
        </div>

        <Card padding="p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
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
              <FornecedorSearchBox
                placeholder="Buscar ou selecionar fornecedor"
                initialValue={fornecedorFiltroNome}
                minLen={1}
                clearOnSelect={false}
                onSelect={(item) => {
                  if (item) {
                    setFornecedorFiltro(item.id);
                    setFornecedorFiltroNome(formatFornecedorLabel(item));
                    upsertFornecedor(item);
                  } else {
                    setFornecedorFiltro('');
                    setFornecedorFiltroNome('');
                  }
                }}
                onClear={() => {
                  setFornecedorFiltro('');
                  setFornecedorFiltroNome('');
                }}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Inicio</label>
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
        </Card>

        <Card padding="p-3">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-5 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-600 mb-1">Fornecedor</label>
              <FornecedorSearchBox
                placeholder="Buscar fornecedor (opcional)"
                initialValue={novaConta.fornecedorNome}
                minLen={1}
                clearOnSelect={false}
                onSelect={(item) => {
                  if (item) {
                    setNovaConta((s) => ({ ...s, fornecedorId: item.id, fornecedorNome: formatFornecedorLabel(item) }));
                    upsertFornecedor(item);
                  } else {
                    setNovaConta((s) => ({ ...s, fornecedorId: '', fornecedorNome: '' }));
                  }
                }}
                onClear={() => setNovaConta((s) => ({ ...s, fornecedorId: '', fornecedorNome: '' }))}
              />
              <p className="mt-1 text-xs text-gray-500">Deixe vazio para conta avulsa.</p>
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
              <label className="block text-xs text-gray-600 mb-1">Descricao</label>
              <input
                type="text"
                name="descricao"
                value={novaConta.descricao}
                onChange={handleChange}
                placeholder="Ex.: Energia, Internet..."
                className="w-full p-2 border rounded text-sm"
              />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <button onClick={criarConta} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                Criar conta
              </button>
            </div>
          </div>
        </Card>

        <Card padding="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Vencimento</th>
                  <th className="px-3 py-2 text-left">Fornecedor</th>
                  <th className="px-3 py-2 text-left">Descricao</th>
                  <th className="px-3 py-2 text-right">Valor</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Pagamento</th>
                  <th className="px-3 py-2 text-right">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {contasPaginadas.map((c) => {
                  const vencida = isVencida(c);
                  if (editando?.id === c.id) {
                    return (
                      <tr key={c.id} className={vencida ? 'bg-red-50' : ''}>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            value={editando.data_vencimento?.slice(0, 10) || ''}
                            onChange={(e) =>
                              setEditando((s) => ({ ...s, data_vencimento: e.target.value }))
                            }
                            className="p-1 border rounded text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <FornecedorSearchBox
                            placeholder="Buscar fornecedor"
                            initialValue={editando.fornecedor_nome || nomeFornecedor(editando.fornecedor_id)}
                            minLen={1}
                            clearOnSelect={false}
                            onSelect={(item) => {
                              if (item) {
                                setEditando((s) => ({ ...s, fornecedor_id: item.id, fornecedor_nome: formatFornecedorLabel(item) }));
                                upsertFornecedor(item);
                              } else {
                                setEditando((s) => ({ ...s, fornecedor_id: '', fornecedor_nome: '' }));
                              }
                            }}
                            onClear={() => setEditando((s) => ({ ...s, fornecedor_id: '', fornecedor_nome: '' }))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="p-1 border rounded w-full text-sm"
                            value={editando.descricao || ''}
                            onChange={(e) =>
                              setEditando((s) => ({ ...s, descricao: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            className="p-1 border rounded w-full text-sm text-right"
                            value={editando.valor}
                            onChange={(e) =>
                              setEditando((s) => ({ ...s, valor: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="p-1 border rounded text-sm"
                            value={editando.status || 'pendente'}
                            onChange={(e) =>
                              setEditando((s) => ({ ...s, status: e.target.value }))
                            }
                          >
                            <option value="pendente">Pendente</option>
                            <option value="paga">Paga</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="date"
                            className="p-1 border rounded text-sm"
                            value={editando.data_pagamento?.slice(0, 10) || ''}
                            onChange={(e) =>
                              setEditando((s) => ({ ...s, data_pagamento: e.target.value }))
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-right space-x-2">
                          <button onClick={salvarEdicao} className="px-2 py-1 text-xs bg-blue-600 text-white rounded">Salvar</button>
                          <button onClick={() => setEditando(null)} className="px-2 py-1 text-xs bg-gray-300 rounded">Cancelar</button>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={c.id} className={vencida ? 'bg-red-50' : ''}>
                      <td className="px-3 py-2">{formatarDataBR(c.data_vencimento)}</td>
                      <td className="px-3 py-2">{nomeFornecedor(c.fornecedor_id) || 'Conta avulsa'}</td>
                      <td className="px-3 py-2">{c.descricao || ''}</td>
                      <td className="px-3 py-2 text-right">{fmtBRL(c.valor)}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2">
                        {c.data_pagamento ? new Date(c.data_pagamento).toLocaleDateString('pt-BR') : ''}
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        {c.status !== 'paga' && (
                          <button
                            onClick={() => marcarComoPaga(c.id)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded"
                          >
                            Marcar como paga
                          </button>
                        )}
                        <button
                          onClick={() => setEditando({ ...c, fornecedor_nome: nomeFornecedor(c.fornecedor_id) })}
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
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={7}>
                      Nenhuma conta encontrada com os filtros atuais.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card padding="px-3 py-2">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-600">
              Pagina <span className="font-medium">{tabelaPage}</span> mostrando{' '}
              <span className="font-medium">{contasPaginadas.length}</span> de{' '}
              <span className="font-medium">{contasFiltradas.length}</span> contas ({tabelaPageSize} por pagina)
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-600" htmlFor="contas-page-size">Por pagina</label>
              <select
                id="contas-page-size"
                value={tabelaPageSize}
                onChange={handleTabelaPageSizeChange}
                className="border rounded text-sm px-2 py-1"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <button
                onClick={handleTabelaPrev}
                disabled={tabelaPage === 1}
                className={`px-3 py-1 rounded-md ${tabelaPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-100 text-gray-700 hover:bg-gray-200 transition'}`}
              >
                Anterior
              </button>
              <button
                onClick={handleTabelaNext}
                disabled={tabelaPage >= totalPaginas}
                className={`px-3 py-1 rounded-md ${tabelaPage >= totalPaginas ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 transition'}`}
              >
                Proxima
              </button>
            </div>
          </div>
        </Card>
      </div>
    </Page>
  );

}
