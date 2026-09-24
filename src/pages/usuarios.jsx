import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Pencil, Power, Save, X, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useAuth } from "../contexts/authcontext";
import { registrarAuditoria } from "../utils/auditoria";
import StatsCards from "../components/statscards";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

const EMPRESA_ID = 1;

// Roles que se pueden asignar desde el admin (NO se muestra "cliente")
const ROLES = [
  { value: "superadmin", label: "Super Administrador" },
  { value: "admin", label: "Administrador" },
  { value: "gerente", label: "Gerente" },
  { value: "cajero", label: "Cajero" },
  { value: "despacho", label: "Despacho" },
];

const ROL_LABEL = {
  superadmin: "Super Administrador",
  admin: "Administrador",
  gerente: "Gerente",
  cajero: "Cajero",
  despacho: "Despacho",
  vendedor: "Vendedor",
  cliente: "Cliente",
};

export default function Usuarios() {
  const { perfil, signUpStaff } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({
    nombre_completo: "",
    email: "",
    password: "",
    rol: "admin",
    id_sucursal: "",
  });

  const cargar = useCallback(async () => {
    setIsLoading(true);
    const [{ data: perf }, { data: suc }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre_completo, email, rol, id_sucursal, activo, created_at").order("created_at", { ascending: false }),
      supabase.from("sucursales").select("id, nombre").eq("id_empresa", EMPRESA_ID),
    ]);
    setUsuarios(perf || []);
    setSucursales(suc || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreSucursal = (id) => sucursales.find((s) => s.id === id)?.nombre || "—";

  const abrirNuevo = () => {
    setEditando(null);
    setForm({ nombre_completo: "", email: "", password: "", rol: "admin", id_sucursal: "" });
    setIsModalOpen(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setForm({ nombre_completo: u.nombre_completo || "", email: u.email || "", password: "", rol: u.rol, id_sucursal: u.id_sucursal || "" });
    setIsModalOpen(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (editando) {
      // Editar rol y sucursal del usuario existente
      const { error } = await supabase
        .from("perfiles")
        .update({ rol: form.rol, id_sucursal: form.id_sucursal ? Number(form.id_sucursal) : null })
        .eq("id", editando.id);
      if (error) return toast.error("Error al actualizar: " + error.message);
      await registrarAuditoria(supabase, perfil, "EDITAR", "Usuarios", `Editó usuario ${editando.email} → rol ${form.rol}`);
      toast.success("Usuario actualizado.");
      setIsModalOpen(false);
      cargar();
      return;
    }

    // Crear nuevo usuario
    if (!form.nombre_completo.trim() || !form.email.trim() || !form.password) {
      return toast.error("Complete nombre, email y contraseña.");
    }
    if (form.password.length < 6) return toast.error("La contraseña debe tener al menos 6 caracteres.");

    setGuardando(true);
    // Guardar la sesión actual del admin para restaurarla luego (signUp cambia la sesión)
    const { data: sesionActual } = await supabase.auth.getSession();
    const original = sesionActual?.session;

    const res = await signUpStaff(form.email, form.password, form.nombre_completo, form.rol, form.id_sucursal || null);

    // Restaurar la sesión del administrador
    if (original?.access_token && original?.refresh_token) {
      await supabase.auth.setSession({ access_token: original.access_token, refresh_token: original.refresh_token });
    }
    setGuardando(false);

    if (!res.success) return toast.error("Error al crear usuario: " + res.error);
    await registrarAuditoria(supabase, perfil, "CREAR", "Usuarios", `Creó usuario ${form.email} con rol ${form.rol}`);
    toast.success("Usuario creado correctamente.");
    setIsModalOpen(false);
    cargar();
  };

  const toggleActivo = async (u) => {
    const nuevo = !(u.activo !== false);
    const res = await Swal.fire({
      title: nuevo ? "¿Activar usuario?" : "¿Desactivar usuario?",
      text: u.email,
      icon: "question",
      background: "#1e1e1e",
      color: "#fff",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;
    const { error } = await supabase.from("perfiles").update({ activo: nuevo }).eq("id", u.id);
    if (error) return toast.error("Error: " + error.message);
    await registrarAuditoria(supabase, perfil, nuevo ? "ACTIVAR" : "DESACTIVAR", "Usuarios", `${nuevo ? "Activó" : "Desactivó"} usuario ${u.email}`);
    cargar();
  };

  const activos = usuarios.filter((u) => u.activo !== false).length;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <StatsCards title={"Total Usuarios"} icon={<Users className="text-title" />} value={usuarios.length} />
        <StatsCards title={"Usuarios Activos"} icon={<Users className="text-green-400" />} value={activos} />
        <StatsCards title={"Staff (no clientes)"} icon={<ShieldCheck className="text-blue-400" />} value={usuarios.filter((u) => u.rol !== "cliente").length} />
      </div>

      <div className="mt-8 border border-secondary rounded-2xl p-5">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title text-xl font-bold">Gestión de Usuarios</h3>
            <p className="text-subtitle text-s">Administra los usuarios y sus roles</p>
          </div>
          <button className="bg-button text-button flex flex-row h-10 gap-3 p-2 rounded-xl items-center cursor-pointer hover:scale-110 transition" onClick={abrirNuevo}>
            <Plus /> Nuevo Usuario
          </button>
        </div>

        <div className="mt-8 overflow-x-auto">
          {isLoading ? (
            <p className="text-title p-4 text-center">Cargando usuarios...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-title p-4 text-center">No hay usuarios registrados.</p>
          ) : (
            <table className="text-title w-full border-collapse">
              <thead>
                <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                  <th className="py-3 px-2 text-left">Nombre</th>
                  <th className="py-3 px-2 text-left">Email</th>
                  <th className="py-3 px-2 text-center">Rol</th>
                  <th className="py-3 px-2 text-left">Sucursal</th>
                  <th className="py-3 px-2 text-center">Estado</th>
                  <th className="py-3 px-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className="border-t border-secondary text-sm hover:bg-secondary transition-colors">
                    <td className="py-3 px-2 font-medium">{u.nombre_completo || "—"}</td>
                    <td className="py-3 px-2 text-blue-400">{u.email}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-secondary text-title">{ROL_LABEL[u.rol] || u.rol}</span>
                    </td>
                    <td className="py-3 px-2 text-subtitle">{nombreSucursal(u.id_sucursal)}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.activo !== false ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
                        {u.activo !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => abrirEditar(u)} className="text-blue-400 hover:text-blue-300" title="Editar rol/sucursal"><Pencil size={18} /></button>
                        {u.rol !== "cliente" && (
                          <button onClick={() => toggleActivo(u)} className={u.activo !== false ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"} title={u.activo !== false ? "Desactivar" : "Activar"}><Power size={18} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative z-10 mx-4 bg-primary text-title p-8 rounded-2xl w-full max-w-lg shadow-lg border border-secondary">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">{editando ? "Editar Usuario" : "Nuevo Usuario"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-subtitle hover:text-title"><X /></button>
            </div>
            <form onSubmit={guardar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Nombre Completo {!editando && "*"}</label>
                <input type="text" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} disabled={!!editando} placeholder="Nombre y apellido" className="bg-input border border-secondary rounded-lg p-3 disabled:opacity-50" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2"><Mail size={16} /> Email {!editando && "*"}</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editando} placeholder="correo@ejemplo.com" className="bg-input border border-secondary rounded-lg p-3 disabled:opacity-50" />
              </div>
              {!editando && (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Contraseña *</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="bg-input border border-secondary rounded-lg p-3" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Rol *</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Sucursal</label>
                <select value={form.id_sucursal} onChange={(e) => setForm({ ...form, id_sucursal: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  <option value="">Sin asignar</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="cursor-pointer bg-secondary border border-secondary font-semibold py-2 px-6 rounded-lg hover:scale-105 transition">Cancelar</button>
                <button type="submit" disabled={guardando} className="cursor-pointer bg-button text-button font-semibold py-2 px-4 rounded-lg hover:scale-105 transition flex gap-2 items-center disabled:opacity-50"><Save size={18} /> {guardando ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
