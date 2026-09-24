import { useState, useEffect, useCallback } from "react";
import { Building2, Plus, Pencil, Power, MapPin, Phone, Save, X } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useAuth } from "../contexts/authcontext";
import { registrarAuditoria } from "../utils/auditoria";
import StatsCards from "../components/statscards";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

const EMPRESA_ID = 1;

export default function Sucursales() {
  const { perfil, rol } = useAuth();
  // El admin solo administra su sucursal asignada; el superadmin ve todo.
  const esAdmin = rol === "admin";
  const [sucursales, setSucursales] = useState([]);
  const [conteoEmpleados, setConteoEmpleados] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({ nombre: "", direccion: "", telefono: "" });

  const cargar = useCallback(async () => {
    setIsLoading(true);
    let query = supabase
      .from("sucursales")
      .select("*")
      .eq("id_empresa", EMPRESA_ID);

    // Restricción por rol: admin solo ve su sucursal.
    if (esAdmin && perfil?.id_sucursal) {
      query = query.eq("id", perfil.id_sucursal);
    }

    const { data, error } = await query.order("id", { ascending: true });
    if (error) console.error("Error cargando sucursales:", error.message);
    setSucursales(data || []);

    // Conteo de empleados por sucursal.
    const { data: empData, error: empError } = await supabase
      .from("empleados")
      .select("id_sucursal")
      .eq("id_empresa", EMPRESA_ID);
    if (!empError && empData) {
      const mapa = {};
      empData.forEach((e) => {
        if (e.id_sucursal != null) {
          mapa[e.id_sucursal] = (mapa[e.id_sucursal] || 0) + 1;
        }
      });
      setConteoEmpleados(mapa);
    }

    setIsLoading(false);
  }, [esAdmin, perfil?.id_sucursal]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNueva = () => {
    setEditando(null);
    setForm({ nombre: "", direccion: "", telefono: "" });
    setIsModalOpen(true);
  };

  const abrirEditar = (s) => {
    setEditando(s);
    setForm({ nombre: s.nombre || "", direccion: s.direccion || "", telefono: s.telefono || "" });
    setIsModalOpen(true);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (editando) {
      const { error } = await supabase
        .from("sucursales")
        .update({ nombre: form.nombre, direccion: form.direccion, telefono: form.telefono })
        .eq("id", editando.id);
      if (error) return toast.error("Error al actualizar: " + error.message);
      await registrarAuditoria(supabase, perfil, "EDITAR", "Sucursales", `Editó sucursal ${form.nombre}`);
      toast.success("Sucursal actualizada.");
    } else {
      const { error } = await supabase.from("sucursales").insert([
        { nombre: form.nombre, direccion: form.direccion, telefono: form.telefono, estado: true, id_empresa: EMPRESA_ID },
      ]);
      if (error) return toast.error("Error al crear: " + error.message);
      await registrarAuditoria(supabase, perfil, "CREAR", "Sucursales", `Creó sucursal ${form.nombre}`);
      toast.success("Sucursal creada.");
    }
    setIsModalOpen(false);
    cargar();
  };

  const toggleEstado = async (s) => {
    const nuevo = !s.estado;
    const res = await Swal.fire({
      title: nuevo ? "¿Activar sucursal?" : "¿Desactivar sucursal?",
      text: s.nombre,
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
    const { error } = await supabase.from("sucursales").update({ estado: nuevo }).eq("id", s.id);
    if (error) return toast.error("Error: " + error.message);
    await registrarAuditoria(supabase, perfil, nuevo ? "ACTIVAR" : "DESACTIVAR", "Sucursales", `${nuevo ? "Activó" : "Desactivó"} sucursal ${s.nombre}`);
    cargar();
  };

  const activas = sucursales.filter((s) => s.estado).length;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <StatsCards title={"Total Sucursales"} icon={<Building2 className="text-title" />} value={sucursales.length} />
        <StatsCards title={"Sucursales Activas"} icon={<Building2 className="text-green-400" />} value={activas} />
        <StatsCards title={"Sucursales Inactivas"} icon={<Building2 className="text-red-400" />} value={sucursales.length - activas} />
      </div>

      <div className="mt-8 border border-secondary rounded-2xl p-5">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title text-xl font-bold">Gestión de Sucursales</h3>
            <p className="text-subtitle text-s">
              {esAdmin ? "Administra la información de tu sucursal asignada" : "Administra las sucursales de la empresa"}
            </p>
            {esAdmin && (
              <span className="inline-flex items-center gap-1 w-fit mt-1 bg-button/20 text-title text-xs font-medium px-2.5 py-1 rounded-full">
                <Building2 size={12} /> Tu sucursal
              </span>
            )}
          </div>
          {!esAdmin && (
            <button
              className="bg-button text-button flex flex-row h-10 gap-3 p-2 rounded-xl items-center cursor-pointer hover:scale-110 transition"
              onClick={abrirNueva}
            >
              <Plus /> Nueva Sucursal
            </button>
          )}
        </div>

        <div className="mt-8 overflow-x-auto">
          {isLoading ? (
            <p className="text-title p-4 text-center">Cargando sucursales...</p>
          ) : sucursales.length === 0 ? (
            <p className="text-title p-4 text-center">No hay sucursales registradas.</p>
          ) : (
            <table className="text-title w-full border-collapse">
              <thead>
                <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                  <th className="py-3 px-2 text-center">#</th>
                  <th className="py-3 px-2 text-left">Nombre</th>
                  <th className="py-3 px-2 text-left">Dirección</th>
                  <th className="py-3 px-2 text-left">Teléfono</th>
                  <th className="py-3 px-2 text-center">Empleados</th>
                  <th className="py-3 px-2 text-center">Estado</th>
                  <th className="py-3 px-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sucursales.map((s) => (
                  <tr key={s.id} className="border-t border-secondary text-sm hover:bg-secondary transition-colors">
                    <td className="py-3 px-2 text-center font-mono">{s.id}</td>
                    <td className="py-3 px-2 font-medium">{s.nombre}</td>
                    <td className="py-3 px-2 text-subtitle">{s.direccion || "—"}</td>
                    <td className="py-3 px-2 text-subtitle">{s.telefono || "—"}</td>
                    <td className="py-3 px-2 text-center text-subtitle">{conteoEmpleados[s.id] || 0}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.estado ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
                        {s.estado ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <div className="flex gap-3 justify-center">
                        <button onClick={() => abrirEditar(s)} className="text-blue-400 hover:text-blue-300" title="Editar">
                          <Pencil size={18} />
                        </button>
                        {!esAdmin && (
                          <button onClick={() => toggleEstado(s)} className={s.estado ? "text-red-400 hover:text-red-300" : "text-green-400 hover:text-green-300"} title={s.estado ? "Desactivar" : "Activar"}>
                            <Power size={18} />
                          </button>
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
              <h3 className="text-2xl font-semibold">{editando ? "Editar Sucursal" : "Nueva Sucursal"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-subtitle hover:text-title"><X /></button>
            </div>
            <form onSubmit={guardar} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Nombre *</label>
                <input type="text" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Sucursal Centro" className="bg-input border border-secondary rounded-lg p-3" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2"><MapPin size={16} /> Dirección</label>
                <input type="text" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Dirección" className="bg-input border border-secondary rounded-lg p-3" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium flex items-center gap-2"><Phone size={16} /> Teléfono</label>
                <input type="tel" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} placeholder="8585-8585" className="bg-input border border-secondary rounded-lg p-3" />
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="cursor-pointer bg-secondary border border-secondary font-semibold py-2 px-6 rounded-lg hover:scale-105 transition">Cancelar</button>
                <button type="submit" className="cursor-pointer bg-button text-button font-semibold py-2 px-4 rounded-lg hover:scale-105 transition flex gap-2 items-center"><Save size={18} /> Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
