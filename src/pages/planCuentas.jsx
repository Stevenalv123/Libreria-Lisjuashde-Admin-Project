import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";
import { useAuth } from "../contexts/authcontext";
import StatsCards from "../components/statscards";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";
import {
    ListTree, ChevronRight, ChevronDown, Plus, Save, X,
    FolderTree, FileText, CheckCircle, XCircle, Layers,
} from "lucide-react";

const TIPOS_RAIZ = ["ACTIVO", "PASIVO", "PATRIMONIO", "INGRESO", "COSTO", "GASTO"];
const SALDOS = ["DEUDOR", "ACREEDOR"];
const REPORTES = ["BALANCE", "RESULTADOS"];

export default function PlanCuentas() {
    const { empresaId } = useEmpresa();
    const { rol } = useAuth();
    const puedeEditar = ["superadmin", "admin", "gerente"].includes(rol);

    const [cuentas, setCuentas] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [expandidos, setExpandidos] = useState({});
    const [seleccion, setSeleccion] = useState(null); // cuenta en edición
    const [modoCrear, setModoCrear] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [form, setForm] = useState(null);

    const cargar = useCallback(async () => {
        if (!empresaId) return;
        setIsLoading(true);
        const { data, error } = await supabase
            .from("cuentas_empresa")
            .select("id_cuenta, codigo, nombre, parent_cuenta_id, es_grupo, tipo_raiz, saldo_normal, tipo_reporte, es_activa, estado, descripcion, es_banco, es_efectivo")
            .eq("id_empresa", empresaId)
            .order("codigo", { ascending: true });
        if (error) {
            toast.error("No se pudo cargar el plan de cuentas.");
            console.error(error.message);
        } else {
            setCuentas(data || []);
        }
        setIsLoading(false);
    }, [empresaId]);

    useEffect(() => { cargar(); }, [cargar]);

    // Construir árbol a partir de parent_cuenta_id
    const { arbol, hijosDe } = useMemo(() => {
        const porPadre = {};
        cuentas.forEach((c) => {
            const k = c.parent_cuenta_id || 0;
            if (!porPadre[k]) porPadre[k] = [];
            porPadre[k].push(c);
        });
        return { arbol: porPadre[0] || [], hijosDe: porPadre };
    }, [cuentas]);

    const toggle = (id) => setExpandidos((p) => ({ ...p, [id]: !p[id] }));

    const abrirDetalle = (c) => { setModoCrear(false); setSeleccion(c); setForm({ ...c }); };

    const abrirCrear = (padre = null) => {
        setModoCrear(true);
        setSeleccion(null);
        setForm({
            codigo: "",
            nombre: "",
            parent_cuenta_id: padre ? padre.id_cuenta : null,
            es_grupo: false,
            tipo_raiz: padre?.tipo_raiz || "ACTIVO",
            saldo_normal: padre?.saldo_normal || "DEUDOR",
            tipo_reporte: padre?.tipo_reporte || "BALANCE",
            es_activa: true,
            estado: true,
            descripcion: "",
            es_banco: false,
            es_efectivo: false,
        });
    };

    const guardar = async () => {
        if (!form.nombre?.trim()) return toast.error("El nombre es obligatorio.");
        if (!form.tipo_raiz) return toast.error("Seleccione el tipo raíz.");
        setGuardando(true);
        try {
            const payload = {
                codigo: form.codigo || null,
                nombre: form.nombre.trim(),
                parent_cuenta_id: form.parent_cuenta_id || null,
                es_grupo: !!form.es_grupo,
                tipo_raiz: form.tipo_raiz,
                saldo_normal: form.saldo_normal,
                tipo_reporte: form.tipo_reporte,
                es_activa: !!form.es_activa,
                estado: !!form.es_activa,
                descripcion: form.descripcion || null,
                es_banco: !!form.es_banco,
                es_efectivo: !!form.es_efectivo,
            };
            if (modoCrear) {
                const { error } = await supabase.from("cuentas_empresa").insert({ ...payload, id_empresa: empresaId });
                if (error) throw error;
                toast.success("Cuenta creada.");
            } else {
                const { error } = await supabase.from("cuentas_empresa").update(payload).eq("id_cuenta", seleccion.id_cuenta);
                if (error) throw error;
                toast.success("Cuenta actualizada.");
            }
            setForm(null); setSeleccion(null); setModoCrear(false);
            await cargar();
        } catch (err) {
            toast.error("Error al guardar: " + err.message);
        } finally {
            setGuardando(false);
        }
    };

    const toggleActiva = async (c) => {
        const nuevo = !c.es_activa;
        const res = await Swal.fire({
            title: nuevo ? "¿Activar cuenta?" : "¿Desactivar cuenta?",
            text: `${c.codigo || ""} ${c.nombre}`,
            icon: "question",
            background: "#152235", color: "#fff",
            showCancelButton: true,
            confirmButtonColor: nuevo ? "#16a34a" : "#dc2626",
            confirmButtonText: nuevo ? "Activar" : "Desactivar",
            cancelButtonText: "Cancelar",
        });
        if (!res.isConfirmed) return;
        const { error } = await supabase.from("cuentas_empresa")
            .update({ es_activa: nuevo, estado: nuevo }).eq("id_cuenta", c.id_cuenta);
        if (error) return toast.error("Error: " + error.message);
        toast.success(nuevo ? "Cuenta activada." : "Cuenta desactivada.");
        cargar();
    };

    const Nodo = ({ c, nivel }) => {
        const hijos = hijosDe[c.id_cuenta] || [];
        const tieneHijos = hijos.length > 0;
        const abierto = expandidos[c.id_cuenta];
        return (
            <div>
                <div
                    className={`flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-secondary/40 cursor-pointer border-b border-secondary/30 ${seleccion?.id_cuenta === c.id_cuenta ? "bg-secondary/50" : ""} ${!c.es_activa ? "opacity-50" : ""}`}
                    style={{ paddingLeft: `${nivel * 18 + 8}px` }}
                    onClick={() => abrirDetalle(c)}
                >
                    {tieneHijos ? (
                        <button onClick={(e) => { e.stopPropagation(); toggle(c.id_cuenta); }} className="text-subtitle">
                            {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                    ) : <span className="w-4" />}
                    {c.es_grupo ? <FolderTree size={16} className="text-yellow-500 shrink-0" /> : <FileText size={16} className="text-blue-400 shrink-0" />}
                    <span className="font-mono text-xs text-subtitle w-20 shrink-0">{c.codigo || "—"}</span>
                    <span className="text-title text-sm flex-1 truncate">{c.nombre}</span>
                    <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-secondary text-subtitle hidden md:inline">{c.tipo_raiz}</span>
                    {!c.es_activa && <span className="text-[0.65rem] px-2 py-0.5 rounded-full bg-red-600/20 text-red-300">Inactiva</span>}
                </div>
                {abierto && hijos.map((h) => <Nodo key={h.id_cuenta} c={h} nivel={nivel + 1} />)}
            </div>
        );
    };

    const totalGrupos = cuentas.filter((c) => c.es_grupo).length;
    const totalDetalle = cuentas.filter((c) => !c.es_grupo).length;
    const totalInactivas = cuentas.filter((c) => !c.es_activa).length;

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <StatsCards title="Total Cuentas" icon={<ListTree className="text-title" />} value={cuentas.length} />
                <StatsCards title="Grupos" icon={<Layers className="text-title" />} value={totalGrupos} color="orange" />
                <StatsCards title="Cuentas de Detalle" icon={<FileText className="text-title" />} value={totalDetalle} color="blue" />
                <StatsCards title="Inactivas" icon={<XCircle className="text-title" />} value={totalInactivas} color="red" />
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Árbol */}
                <div className="lg:col-span-3 border border-secondary rounded-2xl p-5">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-title text-xl font-bold">Plan de Cuentas</h3>
                            <p className="text-subtitle text-sm">Estructura jerárquica de cuentas contables</p>
                        </div>
                        {puedeEditar && (
                            <button onClick={() => abrirCrear(null)} className="bg-button text-button flex items-center gap-2 h-10 px-3 rounded-xl cursor-pointer hover:scale-105 transition">
                                <Plus size={18} /> Nueva Cuenta
                            </button>
                        )}
                    </div>
                    {isLoading ? (
                        <p className="text-subtitle text-center p-6">Cargando…</p>
                    ) : arbol.length === 0 ? (
                        <p className="text-subtitle text-center p-6">No hay cuentas registradas.</p>
                    ) : (
                        <div className="max-h-[60vh] overflow-y-auto pr-1">
                            {arbol.map((c) => <Nodo key={c.id_cuenta} c={c} nivel={0} />)}
                        </div>
                    )}
                </div>

                {/* Ficha / Detalle */}
                <div className="lg:col-span-2 border border-secondary rounded-2xl p-5">
                    {!form ? (
                        <div className="text-center text-subtitle p-6">
                            <ListTree className="mx-auto mb-3" size={32} />
                            Seleccione una cuenta del árbol para ver su ficha{puedeEditar ? ", o cree una nueva." : "."}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-title text-lg font-bold">{modoCrear ? "Nueva Cuenta" : "Editar Cuenta"}</h3>
                                <button onClick={() => { setForm(null); setSeleccion(null); setModoCrear(false); }} className="text-subtitle hover:text-title"><X size={18} /></button>
                            </div>

                            <label className="text-sm text-subtitle">Código</label>
                            <input disabled={!puedeEditar} value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="bg-input border border-secondary rounded-lg p-2.5" placeholder="1.1.01" />

                            <label className="text-sm text-subtitle">Nombre *</label>
                            <input disabled={!puedeEditar} value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="bg-input border border-secondary rounded-lg p-2.5" />

                            <label className="text-sm text-subtitle">Cuenta padre</label>
                            <select disabled={!puedeEditar} value={form.parent_cuenta_id || ""} onChange={(e) => setForm({ ...form, parent_cuenta_id: e.target.value ? Number(e.target.value) : null })} className="bg-input border border-secondary rounded-lg p-2.5">
                                <option value="">(Raíz)</option>
                                {cuentas.filter((c) => c.es_grupo && c.id_cuenta !== form.id_cuenta).map((c) => (
                                    <option key={c.id_cuenta} value={c.id_cuenta}>{c.codigo ? `${c.codigo} · ` : ""}{c.nombre}</option>
                                ))}
                            </select>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-sm text-subtitle">Tipo raíz</label>
                                    <select disabled={!puedeEditar} value={form.tipo_raiz || ""} onChange={(e) => setForm({ ...form, tipo_raiz: e.target.value })} className="bg-input border border-secondary rounded-lg p-2.5 w-full">
                                        {TIPOS_RAIZ.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-subtitle">Saldo normal</label>
                                    <select disabled={!puedeEditar} value={form.saldo_normal || ""} onChange={(e) => setForm({ ...form, saldo_normal: e.target.value })} className="bg-input border border-secondary rounded-lg p-2.5 w-full">
                                        {SALDOS.map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>

                            <label className="text-sm text-subtitle">Tipo de reporte</label>
                            <select disabled={!puedeEditar} value={form.tipo_reporte || ""} onChange={(e) => setForm({ ...form, tipo_reporte: e.target.value })} className="bg-input border border-secondary rounded-lg p-2.5">
                                {REPORTES.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>

                            <div className="flex flex-wrap gap-4 mt-1">
                                <label className="flex items-center gap-2 text-sm text-title"><input type="checkbox" disabled={!puedeEditar} checked={!!form.es_grupo} onChange={(e) => setForm({ ...form, es_grupo: e.target.checked })} className="w-4 h-4 accent-blue-600" /> Es grupo (no recibe movimientos)</label>
                                <label className="flex items-center gap-2 text-sm text-title"><input type="checkbox" disabled={!puedeEditar} checked={!!form.es_banco} onChange={(e) => setForm({ ...form, es_banco: e.target.checked })} className="w-4 h-4 accent-blue-600" /> Es banco</label>
                                <label className="flex items-center gap-2 text-sm text-title"><input type="checkbox" disabled={!puedeEditar} checked={!!form.es_efectivo} onChange={(e) => setForm({ ...form, es_efectivo: e.target.checked })} className="w-4 h-4 accent-blue-600" /> Es efectivo</label>
                            </div>

                            <label className="text-sm text-subtitle">Descripción</label>
                            <textarea disabled={!puedeEditar} rows={2} value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className="bg-input border border-secondary rounded-lg p-2.5" />

                            {puedeEditar && (
                                <div className="flex flex-wrap gap-3 mt-2">
                                    <button onClick={guardar} disabled={guardando} className="bg-button text-button flex items-center gap-2 py-2 px-4 rounded-lg cursor-pointer hover:scale-105 transition disabled:opacity-50">
                                        <Save size={16} /> {guardando ? "Guardando…" : "Guardar"}
                                    </button>
                                    {!modoCrear && seleccion && (
                                        <>
                                            <button onClick={() => abrirCrear(seleccion)} className="bg-secondary border border-secondary flex items-center gap-2 py-2 px-4 rounded-lg cursor-pointer hover:scale-105 transition text-title">
                                                <Plus size={16} /> Subcuenta
                                            </button>
                                            <button onClick={() => toggleActiva(seleccion)} className={`flex items-center gap-2 py-2 px-4 rounded-lg cursor-pointer hover:scale-105 transition ${seleccion.es_activa ? "bg-red-600/20 text-red-300" : "bg-green-600/20 text-green-300"}`}>
                                                {seleccion.es_activa ? <><XCircle size={16} /> Desactivar</> : <><CheckCircle size={16} /> Activar</>}
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
