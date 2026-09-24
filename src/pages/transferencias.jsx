import { useState, useEffect, useCallback } from "react";
import { ArrowLeftRight, Plus, Save, X, Trash2, CheckCircle, PackageSearch } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useAuth } from "../contexts/authcontext";
import { registrarAuditoria } from "../utils/auditoria";
import StatsCards from "../components/statscards";
import { format } from "date-fns/format";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

const EMPRESA_ID = 1;

export default function Transferencias() {
  const { user, perfil } = useAuth();
  const [transferencias, setTransferencias] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [form, setForm] = useState({ origen: "", destino: "", motivo: "" });
  const [lineas, setLineas] = useState([]); // { id_producto, cantidad, costo_unitario }
  const [prodSel, setProdSel] = useState("");
  const [cantSel, setCantSel] = useState(1);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    const [{ data: transf }, { data: suc }, { data: prod }] = await Promise.all([
      supabase
        .from("transferencias_sucursal")
        .select("*, origen:sucursales!transferencias_sucursal_id_sucursal_origen_fkey(nombre), destino:sucursales!transferencias_sucursal_id_sucursal_destino_fkey(nombre), detalle:detalle_transferencia(cantidad)")
        .eq("id_empresa", EMPRESA_ID)
        .order("created_at", { ascending: false }),
      supabase.from("sucursales").select("id, nombre").eq("id_empresa", EMPRESA_ID).eq("estado", true),
      supabase.from("productos").select("id_producto, nombre, precio_compra").eq("id_empresa", EMPRESA_ID),
    ]);
    setTransferencias(transf || []);
    setSucursales(suc || []);
    setProductos(prod || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirModal = () => {
    setForm({ origen: "", destino: "", motivo: "" });
    setLineas([]);
    setProdSel("");
    setCantSel(1);
    setIsModalOpen(true);
  };

  const agregarLinea = () => {
    if (!prodSel) return toast.error("Seleccione un producto.");
    if (Number(cantSel) <= 0) return toast.error("La cantidad debe ser mayor a 0.");
    const prod = productos.find((p) => p.id_producto === Number(prodSel));
    if (!prod) return;
    if (lineas.some((l) => l.id_producto === prod.id_producto)) return toast.error("El producto ya está en la lista.");
    setLineas((prev) => [...prev, { id_producto: prod.id_producto, nombre: prod.nombre, cantidad: Number(cantSel), costo_unitario: Number(prod.precio_compra || 0) }]);
    setProdSel("");
    setCantSel(1);
  };

  const quitarLinea = (idx) => setLineas((prev) => prev.filter((_, i) => i !== idx));

  const guardar = async () => {
    if (!form.origen || !form.destino) return toast.error("Seleccione sucursal origen y destino.");
    if (form.origen === form.destino) return toast.error("El origen y el destino deben ser diferentes.");
    if (lineas.length === 0) return toast.error("Agregue al menos un producto.");

    setGuardando(true);
    try {
      const { data: transf, error: errT } = await supabase
        .from("transferencias_sucursal")
        .insert([{ id_sucursal_origen: Number(form.origen), id_sucursal_destino: Number(form.destino), id_usuario: user.id, motivo: form.motivo, estado: "pendiente", id_empresa: EMPRESA_ID }])
        .select()
        .single();
      if (errT) throw errT;

      const detalle = lineas.map((l) => ({ id_transferencia: transf.id, id_producto: l.id_producto, cantidad: l.cantidad, costo_unitario: l.costo_unitario }));
      const { error: errD } = await supabase.from("detalle_transferencia").insert(detalle);
      if (errD) throw errD;

      await registrarAuditoria(supabase, perfil, "CREAR", "Transferencias", `Creó transferencia #${transf.id} (${lineas.length} productos)`);
      toast.success("Transferencia creada (pendiente de recepción).");
      setIsModalOpen(false);
      cargar();
    } catch (err) {
      console.error(err);
      toast.error("Error al crear transferencia: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const confirmarRecepcion = async (t) => {
    const res = await Swal.fire({
      title: "¿Confirmar recepción?",
      text: `Transferencia #${t.id} pasará a completada.`,
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
    const { error } = await supabase.from("transferencias_sucursal").update({ estado: "completada" }).eq("id", t.id);
    if (error) return toast.error("Error: " + error.message);
    await registrarAuditoria(supabase, perfil, "COMPLETAR", "Transferencias", `Completó transferencia #${t.id}`);
    toast.success("Transferencia completada.");
    cargar();
  };

  const pendientes = transferencias.filter((t) => t.estado === "pendiente").length;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <StatsCards title={"Total Transferencias"} icon={<ArrowLeftRight className="text-title" />} value={transferencias.length} />
        <StatsCards title={"Pendientes"} icon={<ArrowLeftRight className="text-yellow-400" />} value={pendientes} />
        <StatsCards title={"Completadas"} icon={<ArrowLeftRight className="text-green-400" />} value={transferencias.length - pendientes} />
      </div>

      <div className="mt-8 border border-secondary rounded-2xl p-5">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title text-xl font-bold">Transferencias entre Sucursales</h3>
            <p className="text-subtitle text-s">Traslada productos entre sucursales</p>
          </div>
          <button className="bg-button text-button flex flex-row h-10 gap-3 p-2 rounded-xl items-center cursor-pointer hover:scale-110 transition" onClick={abrirModal}>
            <Plus /> Nueva Transferencia
          </button>
        </div>

        <div className="mt-8 overflow-x-auto">
          {isLoading ? (
            <p className="text-title p-4 text-center">Cargando transferencias...</p>
          ) : transferencias.length === 0 ? (
            <p className="text-title p-4 text-center">No hay transferencias registradas.</p>
          ) : (
            <table className="text-title w-full border-collapse">
              <thead>
                <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                  <th className="py-3 px-2 text-left">Fecha</th>
                  <th className="py-3 px-2 text-left">Origen</th>
                  <th className="py-3 px-2 text-left">Destino</th>
                  <th className="py-3 px-2 text-center">Productos</th>
                  <th className="py-3 px-2 text-left">Motivo</th>
                  <th className="py-3 px-2 text-center">Estado</th>
                  <th className="py-3 px-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {transferencias.map((t) => (
                  <tr key={t.id} className="border-t border-secondary text-sm hover:bg-secondary transition-colors">
                    <td className="py-3 px-2 whitespace-nowrap">{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-3 px-2">{t.origen?.nombre || "—"}</td>
                    <td className="py-3 px-2">{t.destino?.nombre || "—"}</td>
                    <td className="py-3 px-2 text-center">{(t.detalle || []).reduce((s, x) => s + x.cantidad, 0)}</td>
                    <td className="py-3 px-2 text-subtitle max-w-xs truncate">{t.motivo || "—"}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${t.estado === "pendiente" ? "bg-yellow-600/20 text-yellow-400" : "bg-green-600/20 text-green-400"}`}>
                        {t.estado === "pendiente" ? "Pendiente" : "Completada"}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      {t.estado === "pendiente" ? (
                        <button onClick={() => confirmarRecepcion(t)} className="text-green-400 hover:text-green-300 flex items-center gap-1 mx-auto" title="Confirmar recepción">
                          <CheckCircle size={18} />
                        </button>
                      ) : (
                        <span className="text-subtitle text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm overflow-y-auto py-8">
          <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative z-10 mx-4 bg-primary text-title p-8 rounded-2xl w-full max-w-2xl shadow-lg border border-secondary my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Nueva Transferencia</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-subtitle hover:text-title"><X /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Sucursal Origen *</label>
                <select value={form.origen} onChange={(e) => setForm({ ...form, origen: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  <option value="">Seleccione</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Sucursal Destino *</label>
                <select value={form.destino} onChange={(e) => setForm({ ...form, destino: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  <option value="">Seleccione</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-sm font-medium">Motivo</label>
              <input type="text" value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ej: Reabastecimiento" className="bg-input border border-secondary rounded-lg p-3" />
            </div>

            {/* Agregar productos */}
            <div className="flex flex-col md:flex-row gap-2 items-end mb-4 bg-secondary/30 p-4 rounded-xl border border-secondary">
              <div className="flex flex-col gap-2 flex-1">
                <label className="text-sm font-medium flex items-center gap-1"><PackageSearch size={16} /> Producto</label>
                <select value={prodSel} onChange={(e) => setProdSel(e.target.value)} className="bg-input border border-secondary rounded-lg p-2">
                  <option value="">Seleccione producto</option>
                  {productos.map((p) => <option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2 w-28">
                <label className="text-sm font-medium">Cantidad</label>
                <input type="number" min="1" value={cantSel} onChange={(e) => setCantSel(e.target.value)} className="bg-input border border-secondary rounded-lg p-2" />
              </div>
              <button onClick={agregarLinea} className="bg-button text-button p-2 rounded-lg flex items-center gap-1 hover:scale-105 transition h-10"><Plus size={18} /> Agregar</button>
            </div>

            {lineas.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="text-title w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-secondary/50 text-subtitle">
                      <th className="py-2 px-2 text-left">Producto</th>
                      <th className="py-2 px-2 text-center">Cantidad</th>
                      <th className="py-2 px-2 text-center">Costo Unit.</th>
                      <th className="py-2 px-2 text-center">Quitar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l, idx) => (
                      <tr key={idx} className="border-t border-secondary">
                        <td className="py-2 px-2">{l.nombre}</td>
                        <td className="py-2 px-2 text-center">{l.cantidad}</td>
                        <td className="py-2 px-2 text-center">C$ {l.costo_unitario.toFixed(2)}</td>
                        <td className="py-2 px-2 text-center">
                          <button onClick={() => quitarLinea(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="cursor-pointer bg-secondary border border-secondary font-semibold py-2 px-6 rounded-lg hover:scale-105 transition">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="cursor-pointer bg-button text-button font-semibold py-2 px-4 rounded-lg hover:scale-105 transition flex gap-2 items-center disabled:opacity-50"><Save size={18} /> {guardando ? "Guardando..." : "Crear Transferencia"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
