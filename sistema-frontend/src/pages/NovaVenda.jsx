import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { FiPlus, FiTrash2, FiArrowLeft, FiSave, FiDollarSign, FiUser, FiShoppingCart } from "react-icons/fi";

export default function NovaVenda() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [cliente_id, setClienteId] = useState("");
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState({ texto: "", tipo: "" });
  const [buscaCliente, setBuscaCliente] = useState("");
  const [buscaProduto, setBuscaProduto] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [resClientes, resProdutos] = await Promise.all([
          api.get("/clientes"),
          api.get("/produtos"),
        ]);
        setClientes(resClientes.data);
        setProdutos(resProdutos.data);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setMensagem({ texto: "Erro ao carregar clientes ou produtos.", tipo: "erro" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const adicionarItem = () => {
    setItens([...itens, { produto_id: "", quantidade: 1 }]);
  };

  const atualizarItem = (index, campo, valor) => {
    const novosItens = [...itens];
    if (campo === "quantidade") {
      novosItens[index][campo] = Math.max(1, Number(valor));
    } else {
      novosItens[index][campo] = valor;
    }
    setItens(novosItens);
  };

  const removerItem = (index) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const calcularTotal = () => {
    return itens.reduce((total, item) => {
      const produto = produtos.find((p) => p.id === item.produto_id);
      if (!produto) return total;
      return total + Number(produto.preco_venda ?? 0) * Number(item.quantidade);
    }, 0);
  };

  const salvarVenda = async () => {
    if (!cliente_id || itens.length === 0) {
      setMensagem({ texto: "Selecione um cliente e adicione pelo menos um produto.", tipo: "erro" });
      return;
    }
    if (itens.some((i) => !i.produto_id)) {
      setMensagem({ texto: "Selecione o produto em todos os itens.", tipo: "erro" });
      return;
    }

    setLoading(true);
    setMensagem({ texto: "", tipo: "" });

    try {
      await api.post("/vendas", {
        cliente_id,
        itens: itens.map((item) => {
          const prod = produtos.find(p => p.id === item.produto_id);
          const preco_unit = Number(prod?.preco_venda ?? 0);
          return {
            produto_id: item.produto_id,
            quantidade: Number(item.quantidade),
            preco_unit, // trava o preço no momento da venda
          };
        }),
      });

      setMensagem({ texto: "Venda registrada com sucesso! Redirecionando...", tipo: "sucesso" });
      setTimeout(() => navigate("/vendas"), 1200);
    } catch (err) {
      console.error("Erro ao salvar venda:", err);
      const detail = err?.response?.data?.detail;
      setMensagem({ texto: typeof detail === "string" ? detail : "Erro ao registrar venda.", tipo: "erro" });
    } finally {
      setLoading(false);
    }
  };

  const clientesFiltrados = clientes.filter(cliente =>
    cliente.nome.toLowerCase().includes(buscaCliente.toLowerCase())
  );

  const produtosFiltrados = produtos.filter(produto =>
    produto.nome.toLowerCase().includes(buscaProduto.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold flex items-center">
              <FiShoppingCart className="mr-2" />
              Nova Venda
            </h1>
            <button
              onClick={() => navigate("/vendas")}
              className="flex items-center bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition"
            >
              <FiArrowLeft className="mr-1" />
              Voltar
            </button>
          </div>
        </div>

        <div className="p-6">
          {mensagem.texto && (
            <div className={`mb-6 p-4 rounded-lg ${
              mensagem.tipo === "sucesso" ? "bg-green-100 text-green-800 border border-green-200"
                                          : "bg-red-100 text-red-800 border-red-200"
            }`}>
              {mensagem.texto}
            </div>
          )}

          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <FiUser className="inline mr-1" />
              Cliente
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar cliente..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={buscaCliente}
                onChange={(e) => setBuscaCliente(e.target.value)}
              />
              <FiUser className="absolute left-3 top-3 text-gray-400" />
            </div>
            <select
              value={cliente_id}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um cliente</option>
              {clientesFiltrados.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} - {c.email || c.telefone || ''}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-700">
                <FiShoppingCart className="inline mr-1" />
                Produtos
              </h2>
              <button
                onClick={adicionarItem}
                className="flex items-center bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                <FiPlus className="mr-1" />
                Adicionar Produto
              </button>
            </div>

            {itens.length === 0 ? (
              <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
                Nenhum produto adicionado
              </div>
            ) : (
              <div className="space-y-4">
                {itens.map((item, index) => {
                  const produto = produtos.find((p) => p.id === item.produto_id);
                  const subtotal = produto ? Number(produto.preco_venda ?? 0) * Number(item.quantidade) : 0;

                  return (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-6">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Buscar produto..."
                              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              value={buscaProduto}
                              onChange={(e) => setBuscaProduto(e.target.value)}
                            />
                            <FiShoppingCart className="absolute left-3 top-3 text-gray-400" />
                          </div>
                          <select
                            value={item.produto_id}
                            onChange={(e) => atualizarItem(index, "produto_id", e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Selecione um produto</option>
                            {produtosFiltrados.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome} - R$ {Number(p.preco_venda ?? 0).toFixed(2)}
                                {p.estoque ? ` (Estoque: ${p.estoque})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-500 mb-1">Quantidade</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantidade}
                            onChange={(e) => atualizarItem(index, "quantidade", e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-500 mb-1">Subtotal</label>
                          <div className="p-2 font-medium">
                            {produto ? `R$ ${subtotal.toFixed(2)}` : "-"}
                          </div>
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                          <button
                            onClick={() => removerItem(index)}
                            className="text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-red-50 transition"
                            title="Remover produto"
                          >
                            <FiTrash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg mb-8">
            <span className="text-lg font-medium text-gray-700">Total:</span>
            <span className="text-2xl font-bold text-blue-600">
              <FiDollarSign className="inline mr-1" />
              {calcularTotal().toFixed(2)}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <button
              onClick={() => { setClienteId(""); setItens([]); setMensagem({ texto: "", tipo: "" }); }}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              Limpar
            </button>
            <button
              onClick={salvarVenda}
              disabled={loading || !cliente_id || itens.length === 0}
              className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processando...
                </>
              ) : (
                <>
                  <FiSave className="mr-2" />
                  Salvar Venda
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
