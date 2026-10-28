import { useState, useEffect, useCallback } from "react";
import { Users, Plus, Pencil, Power, Save, X, Mail, ShieldCheck, Eye, EyeOff, KeyRound, Filter } from "lucide-react";
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

// Roles que obligan a tener sucursal asignada
const ROLES_REQUIEREN_SUCURSAL = ["gerente", "cajero", "despacho"];

export default function Usuarios() {
  const { perfil, signUpStaff } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [verPassword, setVerPassword] = useState(false);
  const [filtroRol, setFiltroRol] = useState("");
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [form, setForm] = useState({
    id_empleado: "",
    nombre_completo: "",
    email: "",
    password: "",
    rol: "admin",
    id_sucursal: "",
    activo: true,
  });

  const cargar = useCallback(async () => {
    setIsLoading(true);
    const [{ data: perf }, { data: suc }, { data: emps }] = await Promise.all([
      supabase.from("perfiles").select("id, nombre_completo, email, rol, id_sucursal, activo, created_at").order("created_at", { ascending: false }),
      supabase.from("sucursales").select("id, nombre").eq("id_empresa", EMPRESA_ID),
      supabase.from("empleados").select("id_empleado, nombre_completo, email, puesto, departamento, id_sucursal, estado").eq("id_empresa", EMPRESA_ID).order("nombre_completo"),
    ]);
    setUsuarios(perf || []);
    setSucursales(suc || []);
    setEmpleados(emps || []);
    setIsLoading(false);
  }, []);

  // Empleados que aún NO tienen usuario (perfil) creado, filtrando por email registrado.
  const emailsConUsuario = new Set((usuarios || []).map((u) => (u.email || "").trim().toLowerCase()).filter(Boolean));
  const empleadosDisponibles = (empleados || []).filter(
    (e) => e.estado === "Activo" && e.email && e.email.trim() && !emailsConUsuario.has(e.email.trim().toLowerCase())
  );

  const seleccionarEmpleado = (idEmpleado) => {
    const emp = empleados.find((e) => String(e.id_empleado) === String(idEmpleado));
    if (!emp) {
      setForm((f) => ({ ...f, id_empleado: "", nombre_completo: "", email: "", id_sucursal: "" }));
      return;
    }
    setForm((f) => ({
      ...f,
      id_empleado: emp.id_empleado,
      nombre_completo: emp.nombre_completo || "",
      email: emp.email || "",
      id_sucursal: emp.id_sucursal ? String(emp.id_sucursal) : f.id_sucursal,
    }));
  };

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreSucursal = (id) => sucursales.find((s) => s.id === id)?.nombre || "—";

  const abrirNuevo = () => {
    setEditando(null);
    setVerPassword(false);
    setForm({ id_empleado: "", nombre_completo: "", email: "", password: "", rol: "admin", id_sucursal: "", activo: true });
    setIsModalOpen(true);
  };

  const abrirEditar = (u) => {
    setEditando(u);
    setVerPassword(false);
    setForm({ id_empleado: "", nombre_completo: u.nombre_completo || "", email: u.email || "", password: "", rol: u.rol, id_sucursal: u.id_sucursal || "", activo: u.activo !== false });
    setIsModalOpen(true);
  };

  const guardar = async (e) => {
    e.preventDefault();

    // Validación común: roles con sucursal obligatoria
    if (ROLES_REQUIEREN_SUCURSAL.includes(form.rol) && !form.id_sucursal) {
      return toast.error("Los roles Gerente, Cajero y Despacho requieren una sucursal asignada.");
    }
    if (form.password && form.password.length > 0 && form.password.length < 6) {
      return toast.error("La nueva contraseña debe tener al menos 6 caracteres.");
    }

    if (editando) {
      // --- EDICIÓN COMPLETA vía RPC admin_actualizar_usuario (solo superadmin) ---
      setGuardando(true);
      const { data, error } = await supabase.rpc("admin_actualizar_usuario", {
        p_id: editando.id,
        p_nombre: form.nombre_completo?.trim() || null,
        p_email: form.email?.trim() || null,
        p_rol: form.rol,
        p_id_sucursal: form.id_sucursal ? Number(form.id_sucursal) : null,
        p_activo: form.activo,
        p_password: form.password && form.password.length >= 6 ? form.password : null,
      });
      setGuardando(false);
      if (error) return toast.error("Error al actualizar: " + error.message);
      await registrarAuditoria(supabase, perfil, "EDITAR", "Usuarios", `Editó usuario ${form.email} → rol ${form.rol}${form.password ? " (contraseña restablecida)" : ""}`);
      toast.success("Usuario actualizado correctamente.");
      setIsModalOpen(false);
      cargar(); // re-fetch: los cambios se reflejan de verdad
      return;
    }

    // --- CREAR nuevo usuario — el nombre proviene del empleado seleccionado ---
    if (!form.id_empleado) {
      return toast.error("Seleccione un empleado registrado en Recursos Humanos.");
    }
    if (!form.nombre_completo.trim() || !form.email.trim() || !form.password) {
      return toast.error("El empleado seleccionado no tiene email, o falta la contraseña.");
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

    if (!res.success) {
      setGuardando(false);
      return toast.error("Error al crear usuario: " + res.error);
    }

    // Confirmar el email para que pueda iniciar sesión de inmediato
    const { error: confErr } = await supabase.rpc("admin_confirmar_usuario", { p_email: form.email.trim() });
    if (confErr) console.warn("No se pudo confirmar el email automáticamente:", confErr.message);

    setGuardando(false);
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
      background: "#152235",
      color: "#fff",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Sí, confirmar",
      cancelButtonText: "Cancelar",
    });
    if (!res.isConfirmed) return;
    const { error } = await supabase.rpc("admin_set_activo", { p_id: u.id, p_activo: nuevo });
    if (error) return toast.error("Error: " + error.message);
    await registrarAuditoria(supabase, perfil, nuevo ? "ACTIVAR" : "DESACTIVAR", "Usuarios", `${nuevo ? "Activó" : "Desactivó"} usuario ${u.email}`);
    cargar();
  };

  const activos = usuarios.filter((u) => u.activo !== false).length;

  // Filtros de la tabla
  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtroRol && u.rol !== filtroRol) return false;
    if (filtroSucursal && String(u.id_sucursal || "") !== String(filtroSucursal)) return false;
    return true;
  });

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatsCards title={"Total Usuarios"} color="blue" icon={<Users size={22} />} value={usuarios.length} />
        <StatsCards title={"Usuarios Activos"} color="green" icon={<Users size={22} />} value={activos} />
        <StatsCards title={"Staff (no clientes)"} color="purple" icon={<ShieldCheck size={22} />} value={usuarios.filter((u) => u.rol !== "cliente").length} />
      </div>

      <div className="erp-card mt-6 p-5">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title text-xl font-bold">Gestión de Usuarios</h3>
            <p className="text-subtitle text-sm">Administra los usuarios, roles, sucursales y accesos</p>
          </div>
          <button className="btn-primary" onClick={abrirNuevo}>
            <Plus size={18} /> Nuevo Usuario
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mt-5">
          <div className="flex items-center gap-2 text-subtitle text-sm">
            <Filter size={16} /> Filtrar:
          </div>
          <select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)} className="bg-input border border-secondary rounded-lg px-3 py-2 text-sm">
            <option value="">Todos los roles</option>
            {Object.keys(ROL_LABEL).map((r) => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
          </select>
          <select value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)} className="bg-input border border-secondary rounded-lg px-3 py-2 text-sm">
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        <div className="mt-5 overflow-x-auto">
          {isLoading ? (
            <p className="text-title p-4 text-center">Cargando usuarios...</p>
          ) : usuariosFiltrados.length === 0 ? (
            <p className="text-subtitle p-4 text-center">No hay usuarios que coincidan con los filtros.</p>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th className="text-center">Rol</th>
                  <th>Sucursal</th>
                  <th className="text-center">Estado</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.nombre_completo || "—"}</td>
                    <td className="text-blue-400">{u.email}</td>
                    <td className="text-center">
                      <span className="badge badge-neutral">{ROL_LABEL[u.rol] || u.rol}</span>
                    </td>
                    <td className="text-subtitle">{nombreSucursal(u.id_sucursal)}</td>
                    <td className="text-center">
                      <span className={`badge ${u.activo !== false ? "badge-success" : "badge-danger"}`}>
                        {u.activo !== false ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="text-center">
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => abrirEditar(u)} className="text-blue-400 hover:text-blue-300" title="Editar usuario"><Pencil size={18} /></button>
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
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm p-4">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative z-10 bg-card text-title p-7 rounded-2xl w-full max-w-lg shadow-2xl border border-secondary max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">{editando ? "Editar Usuario" : "Nuevo Usuario"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-subtitle hover:text-title"><X /></button>
            </div>
            <form onSubmit={guardar} className="flex flex-col gap-4">
              {!editando ? (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Empleado *</label>
                  <select value={form.id_empleado} onChange={(e) => seleccionarEmpleado(e.target.value)} className="bg-input border border-secondary rounded-lg p-3">
                    <option value="">Seleccione un empleado…</option>
                    {empleadosDisponibles.map((e) => (
                      <option key={e.id_empleado} value={e.id_empleado}>
                        {e.nombre_completo}{e.puesto ? ` — ${e.puesto}` : ""}
                      </option>
                    ))}
                  </select>
                  {empleadosDisponibles.length === 0 && (
                    <p className="text-xs text-amber-400">No hay empleados disponibles con email y sin usuario. Regístrelos primero en Recursos Humanos.</p>
                  )}
                  {form.id_empleado && <p className="text-xs text-subtitle">Nombre: <span className="text-title font-medium">{form.nombre_completo}</span></p>}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold">Nombre Completo</label>
                  <input type="text" value={form.nombre_completo} onChange={(e) => setForm({ ...form, nombre_completo: e.target.value })} className="bg-input border border-secondary rounded-lg p-3" />
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2"><Mail size={16} /> Email {!editando && "*"}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@libreria.com"
                  className="bg-input border border-secondary rounded-lg p-3"
                />
              </div>

              {/* Contraseña: obligatoria al crear; opcional (restablecer) al editar */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <KeyRound size={16} /> {editando ? "Nueva contraseña (opcional)" : "Contraseña *"}
                </label>
                <div className="relative">
                  <input
                    type={verPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editando ? "Dejar en blanco para no cambiarla" : "Mínimo 6 caracteres"}
                    className="bg-input border border-secondary rounded-lg p-3 w-full pr-11"
                  />
                  <button type="button" onClick={() => setVerPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-subtitle hover:text-title">
                    {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-subtitle">Las contraseñas se almacenan cifradas: no pueden verse, solo restablecerse.</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Rol *</label>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">
                  Sucursal {ROLES_REQUIEREN_SUCURSAL.includes(form.rol) && <span className="text-red-400">*</span>}
                </label>
                <select value={form.id_sucursal} onChange={(e) => setForm({ ...form, id_sucursal: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  <option value="">Sin asignar</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>

              {editando && (
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4" />
                  <span className="text-sm">Usuario activo (puede iniciar sesión)</span>
                </label>
              )}

              <div className="flex justify-end gap-3 mt-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50"><Save size={18} /> {guardando ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
