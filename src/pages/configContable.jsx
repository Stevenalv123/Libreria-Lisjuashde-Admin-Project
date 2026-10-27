import { useState, useEffect, useCallback } from "react";
import { Settings, Percent, ListChecks, Save, Landmark } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";
import { useAuth } from "../contexts/authcontext";
import Tabs from "../components/tabs";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

// Configuración contable: cuentas por defecto (config_cuentas_defecto) y configuración fiscal (config_fiscal).
export default function ConfigContable() {
    const { empresaId } = useEmpresa();
    const { rol } = useAuth();
    const puedeEditar = ["superadmin", "admin", "gerente"].includes(rol);

    const tabs = [
        { key: "defecto", label: "Cuentas por Defecto", icon: <ListChecks size={16} /> },
        { key: "fiscal", label: "Configuración Fiscal", icon: <Percent size={16} /> },
    ];
    const [activeTab, setActiveTab] = useState("defecto");

    const [reglas, setReglas] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [fiscal, setFiscal] = useState(null);
    const [loading, setLoading] = useState(false);

    const cargar = useCallback(async () => {
        if (!empresaId) return;
        setLoading(true);
        try {
            const [{ data: reglasData }, { data: cuentasData }, { data: fiscalData }] = await Promise.all([
                supabase.from("config_cuentas_defecto")
                    .select("id, modulo, regla, cuenta_id, descripcion, activo")
                    .eq("empresa_id", empresaId).eq("activo", true)
                    .order("modulo").order("regla"),
                supabase.from("cuentas_empresa")
                    .select("id_cuenta, nombre, codigo")
                    .eq("id_empresa", empresaId).eq("estado", true)
                    .order("codigo"),
                supabase.from("config_fiscal").select("*").eq("empresa_id", empresaId).maybeSingle(),
            ]);
            setReglas(reglasData || []);
            setCuentas(cuentasData || []);
            setFiscal(fiscalData || { empresa_id: empresaId, tasa_ir: 30, tasa_iva: 15, ir_configurado: false, notas: "" });
        } catch (err) {
            console.error(err);
            toast.error("No se pudo cargar la configuración contable");
        } finally {
            setLoading(false);
        }
    }, [empresaId]);

    useEffect(() => { cargar(); }, [cargar]);

    const guardarRegla = async (id, cuenta_id) => {
        if (!puedeEditar) return;
        const { error } = await supabase.from("config_cuentas_defecto")
            .update({ cuenta_id: cuenta_id ? Number(cuenta_id) : null }).eq("id", id);
        if (error) { toast.error("Error al guardar la cuenta"); return; }
        setReglas((prev) => prev.map((r) => r.id === id ? { ...r, cuenta_id: Number(cuenta_id) } : r));
        toast.success("Cuenta actualizada");
    };

    const guardarFiscal = async () => {
        if (!puedeEditar) return;
        const payload = {
            empresa_id: empresaId,
            tasa_ir: Number(fiscal.tasa_ir) || 0,
            tasa_iva: Number(fiscal.tasa_iva) || 0,
            ir_configurado: !!fiscal.ir_configurado,
            notas: fiscal.notas || null,
            updated_at: new Date().toISOString(),
        };
        const { error } = fiscal.id
            ? await supabase.from("config_fiscal").update(payload).eq("id", fiscal.id)
            : await supabase.from("config_fiscal").insert(payload);
        if (error) { toast.error("Error al guardar la configuración fiscal"); return; }
        Swal.fire({ icon: "success", title: "Guardado", text: "Configuración fiscal actualizada.", background: "#152235", color: "#fff", timer: 1600, showConfirmButton: false });
        cargar();
    };

    const modulosUnicos = [...new Set(reglas.map((r) => r.modulo))];

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
                <Settings className="text-title" size={26} />
                <div>
                    <h1 className="text-title text-2xl font-bold">Configuración Contable</h1>
                    <p className="text-subtitle text-sm">Cuentas por defecto y parámetros fiscales de la empresa.</p>
                </div>
            </div>

            <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

            {!puedeEditar && (
                <div className="erp-card p-3 text-sm text-subtitle">Solo lectura. Tu rol no permite editar la configuración contable.</div>
            )}

            {activeTab === "defecto" && (
                <div className="flex flex-col gap-4">
                    {loading && <p className="text-subtitle">Cargando…</p>}
                    {modulosUnicos.map((mod) => (
                        <div key={mod} className="erp-card p-4">
                            <h3 className="text-title font-bold mb-3 flex items-center gap-2"><Landmark size={16} /> {mod}</h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-subtitle text-left border-b border-secondary">
                                            <th className="py-2 pr-4">Regla</th>
                                            <th className="py-2 pr-4">Descripción</th>
                                            <th className="py-2">Cuenta asignada</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reglas.filter((r) => r.modulo === mod).map((r) => (
                                            <tr key={r.id} className="border-b border-secondary/50">
                                                <td className="py-2 pr-4 text-title font-medium">{r.regla}</td>
                                                <td className="py-2 pr-4 text-subtitle">{r.descripcion || "—"}</td>
                                                <td className="py-2">
                                                    <select
                                                        disabled={!puedeEditar}
                                                        value={r.cuenta_id || ""}
                                                        onChange={(e) => guardarRegla(r.id, e.target.value)}
                                                        className="bg-input text-title border border-secondary rounded-lg px-3 py-1.5 min-w-[260px]"
                                                    >
                                                        <option value="">— Sin asignar —</option>
                                                        {cuentas.map((c) => (
                                                            <option key={c.id_cuenta} value={c.id_cuenta}>{c.codigo} · {c.nombre}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                    {!loading && reglas.length === 0 && <div className="erp-card p-6 text-center text-subtitle">No hay reglas de cuentas por defecto configuradas.</div>}
                </div>
            )}

            {activeTab === "fiscal" && fiscal && (
                <div className="erp-card p-6 max-w-2xl flex flex-col gap-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <label className="text-subtitle text-sm">Tasa IR (%)</label>
                            <input type="number" step="0.01" disabled={!puedeEditar}
                                value={fiscal.tasa_ir ?? ""}
                                onChange={(e) => setFiscal({ ...fiscal, tasa_ir: e.target.value })}
                                className="bg-input text-title border border-secondary rounded-lg px-3 py-2" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-subtitle text-sm">Tasa IVA (%)</label>
                            <input type="number" step="0.01" disabled={!puedeEditar}
                                value={fiscal.tasa_iva ?? ""}
                                onChange={(e) => setFiscal({ ...fiscal, tasa_iva: e.target.value })}
                                className="bg-input text-title border border-secondary rounded-lg px-3 py-2" />
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="checkbox" disabled={!puedeEditar}
                            checked={!!fiscal.ir_configurado}
                            onChange={(e) => setFiscal({ ...fiscal, ir_configurado: e.target.checked })}
                            className="w-4 h-4" />
                        <span className="text-title text-sm">IR configurado (habilita el cálculo de IR en Estados Financieros)</span>
                    </label>
                    {!fiscal.ir_configurado && (
                        <p className="text-sm text-amber-500">⚠️ IR pendiente de configurar — no se calculará el IR hasta activar esta opción.</p>
                    )}

                    <div className="flex flex-col gap-1">
                        <label className="text-subtitle text-sm">Notas</label>
                        <textarea rows={3} disabled={!puedeEditar}
                            value={fiscal.notas || ""}
                            onChange={(e) => setFiscal({ ...fiscal, notas: e.target.value })}
                            className="bg-input text-title border border-secondary rounded-lg px-3 py-2" />
                    </div>

                    {puedeEditar && (
                        <button onClick={guardarFiscal} className="btn-primary self-start flex items-center gap-2">
                            <Save size={16} /> Guardar configuración fiscal
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
