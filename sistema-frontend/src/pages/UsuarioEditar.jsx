import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import FormUsuario from "../components/FormUsuario";


export default function UsuarioEditar() {
  const { id } = useParams();
  const [usuario, setUsuario] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsuario = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await api.get("/usuarios", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const found = response.data.find((u) => u.id === id);
        setUsuario(found);
      } catch (err) {
        console.error("Erro ao buscar usuário:", err);
      }
    };
    fetchUsuario();
  }, [id]);

  const handleUpdate = async (data) => {
    try {
      const token = localStorage.getItem("token");
      await api.put(`/usuarios/${id}`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      alert("Usuário atualizado com sucesso!");
      navigate("/usuarios");
    } catch (err) {
      console.error("Erro ao atualizar usuário:", err);
      alert("Erro ao atualizar usuário.");
    }
  };

  if (!usuario) return <div className="p-6">Carregando...</div>;

  return (
    <div className="p-6 max-w-lg mx-auto bg-white shadow rounded-xl">
      <h2 className="text-xl font-bold mb-4">Editar Usuário</h2>
      <FormUsuario initialData={usuario} onSubmit={handleUpdate} />
    </div>
  );
}
