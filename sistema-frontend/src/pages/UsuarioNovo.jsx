import { useNavigate } from "react-router-dom";
import api from "../services/api";
import FormUsuario from "../components/FormUsuario";

export default function UsuarioNovo() {
  const navigate = useNavigate();

  const handleCreate = async (data) => {
    console.log("Dados enviados:", data);
    try {
      const token = localStorage.getItem("token");
      await api.post("/usuarios", data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Usuário cadastrado com sucesso!");
      navigate("/usuarios");
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
      alert("Erro ao cadastrar usuário.");
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-4">Cadastrar Usuário</h2>
      <FormUsuario onSubmit={handleCreate} />
    </div>
  );
}
