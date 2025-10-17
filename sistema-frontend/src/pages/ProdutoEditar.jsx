import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { FiSave, FiArrowLeft, FiPackage, FiRefreshCw, FiChevronDown, FiSearch } from "react-icons/fi";

/* ===== Helpers ===== */
const toNumber2 = (v) => {
  const s = String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
};
const toISODate = (d) => {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
    return dt.toISOString().slice(0, 10);
  } catch {
    return String(d).slice(0, 10);
  }
};
const firstKey = (o, keys) => keys.find((k) => o && o[k] != null);

/* Normaliza resposta: array direto ou {items:[...]}; id/nome flexíveis */
const normalizeOptions = (data) => {
  const arr = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return arr
    .map((r) => {
      const idK = firstKey(r, ["id", "uuid", "_id"]);
      const nameK = firstKey(r, ["nome", "razao_social", "fantasia", "razao", "name"]);
      if (!idK || !nameK) return null;
      return { id: String(r[idK]), nome: String(r[nameK]) };
    })
    .filter(Boolean);
};

const MAX_PAGE = 200; // seu backend limita a 200
const commonParams = (pg, term) => {
  const q = term || "";
  const off = (pg - 1) * MAX_PAGE;
  return {
    page: pg,
    per_page: MAX_PAGE,
    limit: MAX_PAGE,
    offset: off,
    start: off,
    size: MAX_PAGE,
    q,
    search: q,
    term: q,
    nome: q,
  };
};

/* ====== Combobox reutilizável (busca server-side com paginação) ====== */
function ComboBox({
  label,
  placeholder = "Buscar...",
  value,                 // id selecionado (string)
  displayValue,          // label selecionada (string)
  onChange,              // (id, label) => void
  fetchPage,             // async (term, page) => { items:[{id,nome}], hasMore:boolean }
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  // reset quando muda termo
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [debounced]);

  // fechar ao clicar fora
  useEffect(() => {
    const handler = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // carregar página
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { items: list, hasMore: more } = await fetchPage(debounced, page);
        if (!active) return;
        setHasMore(!!more);
        setItems((prev) => {
          const merged = page > 1 ? [...prev, ...list] : list;
          // garante o selecionado no topo se não vier na página atual
          if (value && displayValue && !merged.some((x) => String(x.id) === String(value))) {
            return [{ id: String(value), nome: displayValue }, ...merged];
          }
          return merged;
        });
      } catch {
        if (!active) return;
        if (page === 1) setItems(value && displayValue ? [{ id: String(value), nome: displayValue }] : []);
        setHasMore(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, page, debounced, fetchPage, value, displayValue]);

  const selectItem = (opt) => {
    onChange(opt.id, opt.nome);
    setOpen(false);
    setTerm(""); // limpa busca
  };

  const onKeyDown = (e) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(items.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && items[highlight]) selectItem(items[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1" ref={wrapRef}>
      {label ? <span className="text-sm text-gray-600">{label}</span> : null}
      <div className="relative">
        {/* Input visual do combobox */}
        <input
          ref={inputRef}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-8 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={placeholder}
          value={open ? term : (displayValue || "")}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        {/* Dropdown */}
        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-3 py-2 flex items-center gap-2">
              <FiSearch className="text-gray-400" />
              <input
                className="w-full outline-none text-sm"
                placeholder="Digite para buscar…"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                autoFocus
              />
            </div>

            {items.length === 0 && !loading && (
              <div className="px-3 py-2 text-sm text-gray-500">Nenhum resultado.</div>
            )}

            {items.map((opt, idx) => {
              const selected = String(value || "") === String(opt.id);
              const hovered = idx === highlight;
              return (
                <button
                  key={`${opt.id}-${idx}`}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm ${
                    hovered ? "bg-blue-50" : selected ? "bg-gray-50" : ""
                  }`}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => selectItem(opt)}
                >
                  {opt.nome}
                  {selected ? <span className="ml-2 text-xs text-blue-600">(selecionado)</span> : null}
                </button>
              );
            })}

            {hasMore && (
              <div className="p-2 border-t border-gray-100 bg-white">
                <button
                  type="button"
                  className="text-sm px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                >
                  {loading ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===== Página ===== */
export default function ProdutoEditar() {
  const navigate = useNavigate();
  const { id } = useParams();

  const token = useMemo(() => localStorage.getItem("token"), []);
  useEffect(() => {
    if (!token) navigate("/login");
  }, [token, navigate]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ texto: "", tipo: "" });
  const [unidades, setUnidades] = useState([]);
  const [unidadesLoading, setUnidadesLoading] = useState(false);

  const [form, setForm] = useState({
    nome: "",
    codigo_produto: "",
    codigo_barras: "",
    custo: "",
    custo_medio: "",
    preco_venda: "",
    estoque: "",
    estoque_minimo: "",
    unidade_id: "",
    marca: "",
    localizacao: "",
    fornecedor: "",      // rótulo opcional
    fornecedor_id: "",   // combobox
    categoria_id: "",    // combobox
    data_validade: "",
    ativo: true,
  });

  /* --------- Carregar produto --------- */
  useEffect(() => {
    const load = async () => {
      if (!token) return;
      setLoading(true);
      setMsg({ texto: "", tipo: "" });
      try {
        const r = await api.get(`/produtos/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const p = r?.data || {};
        setForm((prev) => ({
          ...prev,
          nome: p.nome || "",
          codigo_produto: p.codigo_produto || "",
          codigo_barras: p.codigo_barras || "",
          custo: p.custo ?? "",
          custo_medio: p.custo_medio ?? p.custo ?? "",
          preco_venda: p.preco_venda ?? "",
          estoque: Number.isFinite(p.estoque) ? String(p.estoque) : "",
          estoque_minimo: Number.isFinite(p.estoque_minimo) ? String(p.estoque_minimo) : "",
          unidade_id: p.unidade_id || p?.unidade_medida?.id || "",
          marca: p.marca || "",
          localizacao: p.localizacao || "",
          fornecedor: p.fornecedor || p?.fornecedor_obj?.nome || "",
          fornecedor_id: p.fornecedor_id || p?.fornecedor_obj?.id || "",
          categoria_id: p.categoria_id || p?.categoria?.id || "",
          data_validade: p.data_validade ? toISODate(p.data_validade) : "",
          ativo: p.ativo ?? true,
        }));
      } catch (e) {
        console.error(e);
        setMsg({ texto: "Não foi possível carregar o produto.", tipo: "erro" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, token, navigate]);

  useEffect(() => {
    const fetchUnidades = async () => {
      if (!token) return;
      try {
        setUnidadesLoading(true);
        const response = await api.get("/unidades-medida", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const lista = Array.isArray(response.data) ? response.data : response.data?.items || [];
        setUnidades(lista);
      } catch (err) {
        console.error("Erro ao carregar unidades de medida:", err);
        setMsg((prev) => (prev.texto ? prev : { texto: "Erro ao carregar unidades de medida.", tipo: "erro" }));
      } finally {
        setUnidadesLoading(false);
      }
    };

    fetchUnidades();
  }, [token]);

  /* --------- Fetchers do combobox (server-side) --------- */
  const fetchCategorias = async (term, page) => {
    try {
      const r = await api.get("/categorias", {
        params: commonParams(page, term),
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = normalizeOptions(r?.data);
      return { items: list, hasMore: list.length === MAX_PAGE };
    } catch {
      return { items: [], hasMore: false };
    }
  };

  const fetchFornecedores = async (term, page) => {
    try {
      const r = await api.get("/fornecedores", {
        params: commonParams(page, term),
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = normalizeOptions(r?.data);
      return { items: list, hasMore: list.length === MAX_PAGE };
    } catch {
      return { items: [], hasMore: false };
    }
  };

  const onChange = (k, v) =>
    setForm((f) => {
      if (k === "custo") {
        const next = { ...f, custo: v };
        if (!f.custo_medio) {
          next.custo_medio = v;
        }
        return next;
      }
      if (k === "custo_medio") {
        return { ...f, custo_medio: v };
      }
      return { ...f, [k]: v };
    });

  /* --------- Submit --------- */
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!token) return navigate("/login");
    const payload = {
      nome: form.nome || undefined,
      codigo_produto: form.codigo_produto || undefined,
      codigo_barras: form.codigo_barras || undefined,
      custo: form.custo !== "" ? toNumber2(form.custo) : undefined,
      custo_medio: form.custo_medio !== "" ? toNumber2(form.custo_medio) : undefined,
      preco_venda: form.preco_venda !== "" ? toNumber2(form.preco_venda) : undefined,
      estoque: form.estoque !== "" ? Number(form.estoque) : undefined,
      estoque_minimo: form.estoque_minimo !== "" ? Number(form.estoque_minimo) : undefined,
      marca: form.marca || undefined,
      localizacao: form.localizacao || undefined,
      fornecedor_id: form.fornecedor_id || undefined,
      categoria_id: form.categoria_id || undefined,
      fornecedor: form.fornecedor || undefined, // rótulo opcional
      data_validade: form.data_validade || undefined,
      ativo: !!form.ativo,
    };

    const unidadeId = (form.unidade_id || "").trim();
    payload.unidade_id = unidadeId || null;
    setSaving(true);
    setMsg({ texto: "", tipo: "" });
    try {
      await api.put(`/produtos/${encodeURIComponent(id)}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMsg({ texto: "Produto atualizado com sucesso.", tipo: "sucesso" });
      setTimeout(() => navigate("/produtos", { replace: true }), 600);
    } catch (e) {
      console.error(e);
      const detail = e?.response?.data?.detail;
      setMsg({ texto: typeof detail === "string" ? detail : "Erro ao atualizar produto.", tipo: "erro" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse h-6 w-48 bg-gray-200 rounded mb-4" />
        <div className="animate-pulse h-10 w-full bg-gray-200 rounded mb-2" />
        <div className="animate-pulse h-10 w-full bg-gray-200 rounded mb-2" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <FiPackage /> Editar Produto
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => navigate("/produtos")}
            className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
            type="button"
          >
            <FiArrowLeft className="mr-2" /> Voltar
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition"
            type="button"
            title="Recarregar"
          >
            <FiRefreshCw />
          </button>
          <button
            form="form-edit-prod"
            type="submit"
            className={`flex items-center px-4 py-2 rounded-lg text-white transition ${
              saving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={saving}
          >
            <FiSave className="mr-2" /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Mensagens */}
      {msg.texto ? (
        <div
          className={`mb-4 p-3 rounded border ${
            msg.tipo === "erro"
              ? "bg-red-100 border-red-300 text-red-700"
              : "bg-green-100 border-green-300 text-green-700"
          }`}
        >
          {msg.texto}
        </div>
      ) : null}

      {/* Form */}
      <form id="form-edit-prod" onSubmit={onSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nome */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Nome*</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={form.nome}
              onChange={(e) => onChange("nome", e.target.value)}
              required
            />
          </label>

          {/* Código do Produto */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Código do Produto</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-gray-600 cursor-not-allowed"
              value={form.codigo_produto}
              readOnly
              placeholder="Gerado automaticamente se vazio"
              title="O código do produto não pode ser alterado na edição."
            />
          </label>

          {/* Código de Barras */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Código de Barras</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              value={form.codigo_barras}
              onChange={(e) => onChange("codigo_barras", e.target.value)}
            />
          </label>

          {/* Custo */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Custo (última compra)</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              inputMode="decimal"
              value={form.custo}
              onChange={(e) => onChange("custo", e.target.value)}
              placeholder="0,00"
            />
          </label>

          {/* Custo médio */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Custo médio</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              inputMode="decimal"
              value={form.custo_medio}
              onChange={(e) => onChange("custo_medio", e.target.value)}
              placeholder="0,00"
            />
          </label>

          {/* Preço de Venda */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Preço de Venda</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              inputMode="decimal"
              value={form.preco_venda}
              onChange={(e) => onChange("preco_venda", e.target.value)}
              placeholder="0,00"
            />
          </label>

          {/* Estoque */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Estoque</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              inputMode="numeric"
              value={form.estoque}
              onChange={(e) => onChange("estoque", e.target.value.replace(/[^\d-]/g, ""))}
              placeholder="0"
            />
          </label>

          {/* Estoque mínimo */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Estoque mínimo</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              inputMode="numeric"
              value={form.estoque_minimo}
              onChange={(e) => onChange("estoque_minimo", e.target.value.replace(/[^\d-]/g, ""))}
              placeholder="0"
            />
          </label>

          {/* Unidade */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Unidade de Medida*</span>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2"
              value={form.unidade_id}
              onChange={(e) => onChange("unidade_id", e.target.value)}
              required
              disabled={unidadesLoading || unidades.length === 0}
            >
              <option value="">Selecione a unidade</option>
              {unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.sigla} - {u.nome}
                </option>
              ))}
            </select>
            {unidadesLoading ? (
              <span className="text-xs text-gray-500">Carregando unidades...</span>
            ) : unidades.length === 0 ? (
              <span className="text-xs text-red-500">Cadastre unidades antes de editar produtos.</span>
            ) : null}
          </label>

          {/* Marca */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Marca</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              value={form.marca}
              onChange={(e) => onChange("marca", e.target.value)}
            />
          </label>

          {/* Localização */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Localização</span>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2"
              value={form.localizacao}
              onChange={(e) => onChange("localizacao", e.target.value)}
            />
          </label>

          {/* Fornecedor — COMBOBOX ÚNICO */}
          <ComboBox
            label="Fornecedor"
            placeholder={form.fornecedor ? form.fornecedor : "Buscar fornecedores…"}
            value={form.fornecedor_id}
            displayValue={form.fornecedor}
            onChange={(id, label) => {
              onChange("fornecedor_id", id);
              onChange("fornecedor", label || "");
            }}
            fetchPage={fetchFornecedores}
          />

          {/* Categoria — COMBOBOX ÚNICO */}
          <ComboBox
            label="Categoria"
            placeholder="Buscar categorias…"
            value={form.categoria_id}
            displayValue={form.categoria?.nome || ""}
            onChange={(id, label) => onChange("categoria_id", id)}
            fetchPage={fetchCategorias}
          />

          {/* Data de validade */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Data de validade</span>
            <input
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-2"
              value={form.data_validade}
              onChange={(e) => onChange("data_validade", e.target.value)}
            />
          </label>

          {/* Ativo */}
          <label className="flex items-center gap-2 mt-6">
            <input type="checkbox" checked={!!form.ativo} onChange={(e) => onChange("ativo", e.target.checked)} />
            <span className="text-sm text-gray-700">Ativo</span>
          </label>
        </div>
      </form>
    </div>
  );
}
