import { useState, useEffect, useCallback } from "react";
import { Banknote, CheckCircle2, RefreshCw, Scale } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";
import StatsCards from "../components/statscards";
import { toast } from "react-hot-toast";

const fmt = (n) => `C$ ${Number(n || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ConciliacionBancaria() {
    const { empresaId } = useEmpresa();
    const [cuentas, setCuentas] = useState([]);
    const [cuentaId, setCuentaId] = useState("");
    const hoy = new Date().toISOString().slice(0, 10);
    const [desde, setDesde] = useState(hoy.slice(0, 8) + "01");
    const [hasta, setHasta] = useState(hoy);
    const [movs, setMovs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saldoExtracto, setSaldoExtracto] = useState("");

    useEffect(() => {
        if (!empresaId) return;
        supabase.from("cuentas_empresa").select("id_cuenta, nombre, codigo")
            .eq("id_empresa", empresaId).eq("es_banco", true).eq("estado", true).order("codigo")
            .then(({ data }) => { setCuentas(data || []); if (data && data[0]) setCuentaId(String(data[0].id_cuenta)); });
    }, [empresaId]);

    const cargar = useCallback(async () => {
        if (!cuentaId) return;
        setLoading(true);
        const { data, error } = await supabase.from("movimiento")
            .select("id_movimiento, fecha, tipo, monto, descripcion, referencia, conciliado, fecha_conciliacion, comprobante_id")
            .eq("id_cuenta", Number(cuentaId))
            .gte("fecha", desde).lte("fecha", hasta)
            .order("fecha").order("id_movimiento");
        if (error) toast.error("No se pudieron cargar los movimientos");
        setMovs(data || []);
        setLoading(false);
    }, [cuentaId, desde, hasta]);

    useEffect(() => { cargar(); }, [cargar]);

    const toggle = async (m) => {
        const nuevo = !m.conciliado;
        const { error } = await supabase.from("movimiento")
            .update({ conciliado: nuevo, fecha_conciliacion: nuevo ? hoy : null })
            .eq("id_movimiento", m.id_movimiento);
        if (error) { toast.error("No se pudo actualizar la conciliación"); return; }
        setMovs((prev) => prev.map((x) => x.id_movimiento === m.id_movimiento ? { ...x, conciliado: nuevo, fecha_conciliacion: nuevo ? hoy : null } : x));
    };

    const signo = (m) => (m.tipo === "DEBE" ? 1 : -1); // DEBE aumenta banco (activo), HABER disminuye
    const saldoLibros = movs.reduce((s, m) => s + signo(m) * Number(m.monto || 0), 0);
    const saldoConciliado = movs.filter((m) => m.conciliado).reduce((s, m) => s + signo(m) * Number(m.monto || 0), 0);
    const diferencia = (Number(saldoExtracto) || 0) - saldoConciliado;

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <Scale className="text-title" size={26} />
                    <div>
                        <h1 className="text-title text-2xl font-bold">Conciliación Bancaria</h1>
                        <p className="text-subtitle text-sm">Marca los movimientos que aparecen en el extracto del banco.</p>
                    </div>
                </div>
                <button onClick={cargar} className="btn-secondary"><RefreshCw size={16} /> Actualizar</button>
            </div>

            <div className="erp-card p-4 flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-subtitle text-xs">Cuenta bancaria</label>
                    <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className="bg-input text-title border border-secondary rounded-lg px-3 py-2 min-w-[240px]">
                        <option value="">Seleccione…</option>
                        {cuentas.map((c) => <option key={c.id_cuenta} value={c.id_cuenta}>{c.codigo} · {c.nombre}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-subtitle text-xs">Desde</label>
                    <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="bg-input text-title border border-secondary rounded-lg px-3 py-2" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-subtitle text-xs">Hasta</label>
                    <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="bg-input text-title border border-secondary rounded-lg px-3 py-2" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-subtitle text-xs">Saldo del extracto</label>
                    <input type="number" step="0.01" value={saldoExtracto} onChange={(e) => setSaldoExtracto(e.target.value)} placeholder="0.00" className="bg-input text-title border border-secondary rounded-lg px-3 py-2 w-36" />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCards title="Saldo en libros" value={fmt(saldoLibros)} icon={<Banknote size={20} />} color="blue" />
                <StatsCards title="Saldo conciliado" value={fmt(saldoConciliado)} icon={<CheckCircle2 size={20} />} color="green" />
                <StatsCards title="Diferencia vs extracto" value={fmt(diferencia)} icon={<Scale size={20} />} color={Math.abs(diferencia) < 0.005 ? "green" : "red"} />
            </div>

            <div className="erp-card p-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-subtitle text-left border-b border-secondary">
                            <th className="py-2 pr-4">Conciliado</th>
                            <th className="py-2 pr-4">Fecha</th>
                            <th className="py-2 pr-4">Descripción</th>
                            <th className="py-2 pr-4">Tipo</th>
                            <th className="py-2 pr-4 text-right">Monto</th>
                            <th className="py-2">Fecha concil.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={6} className="py-4 text-subtitle">Cargando…</td></tr>}
                        {movs.map((m) => (
                            <tr key={m.id_movimiento} className="border-b border-secondary/50">
                                <td className="py-2 pr-4">
                                    <input type="checkbox" checked={!!m.conciliado} onChange={() => toggle(m)} className="w-4 h-4 cursor-pointer" />
                                </td>
                                <td className="py-2 pr-4 text-subtitle whitespace-nowrap">{m.fecha}</td>
                                <td className="py-2 pr-4 text-title">{m.descripcion || m.referencia || "—"}</td>
                                <td className="py-2 pr-4 text-subtitle">{m.tipo}</td>
                                <td className={`py-2 pr-4 text-right ${m.tipo === "DEBE" ? "text-emerald-400" : "text-red-400"}`}>{fmt(m.monto)}</td>
                                <td className="py-2 text-subtitle">{m.fecha_conciliacion || "—"}</td>
                            </tr>
                        ))}
                        {!loading && movs.length === 0 && <tr><td colSpan={6} className="py-4 text-subtitle">Sin movimientos para esta cuenta en el rango.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
