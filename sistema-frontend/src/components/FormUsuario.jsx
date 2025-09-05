import { useState, useEffect } from "react";

export default function FormUsuario({ onSubmit, initialData = null }) {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    tipo: "cliente",
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        nome: initialData.nome || "", 
        email: initialData.email || "",
        senha: "", // senha nunca vem preenchida
        tipo: initialData.tipo || "cliente",
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Se o campo for "tipo", sempre salva em lowercase
    setFormData((prev) => ({
      ...prev,
      [name]: name === "tipo" ? value.toLowerCase() : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // garante que "tipo" seja enviado em lowercase
    const dataToSend = {
      ...formData,
      tipo: formData.tipo.toLowerCase(),
    };

    onSubmit(dataToSend);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Nome */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nome Completo *
        </label>
        <input
          type="text"
          name="nome"
          value={formData.nome}
          onChange={handleChange}
          placeholder="Nome completo"
          className="w-full p-2 border border-gray-300 rounded-lg"
          required
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email *
        </label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="email@dominio.com"
          className="w-full p-2 border border-gray-300 rounded-lg"
          required
        />
      </div>

      {/* Senha */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Senha {initialData ? "(preencha apenas se for trocar)" : "*"}
        </label>
        <input
          type="password"
          name="senha"
          value={formData.senha}
          onChange={handleChange}
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          className="w-full p-2 border border-gray-300 rounded-lg"
          required={!initialData}
        />
      </div>

      {/* Tipo de Usuário */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tipo de Usuário *
        </label>
        <select
          name="tipo"
          value={formData.tipo}
          onChange={handleChange}
          className="w-full p-2 border border-gray-300 rounded-lg"
        >
          <option value="admin">Administrador</option>
          <option value="cliente">Cliente</option>
          <option value="financeiro">Financeiro</option>
          <option value="estoque">Estoque</option>
          <option value="vendas">Vendas</option>
        </select>
      </div>

      {/* Botões */}
      <div className="flex space-x-2">
        <button
          type="button"
          className="px-4 py-2 bg-gray-300 rounded-lg"
          onClick={() => window.history.back()}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-green-600 text-white rounded-lg"
        >
          Salvar
        </button>
      </div>
    </form>
  );
}
