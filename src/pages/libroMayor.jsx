import { useState, useEffect, useCallback } from "react";
import { BookOpen, Filter, RefreshCw } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";
import { toast } from "react-hot-toast";

const fmt = (n) => `C$ ${Number(n || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function LibroMayor() {
    const { empresaId } = useEmpresa();
    const [cuentas, setCuentas] = useState([]);
    const [cuentaId, setCuentaId] = useState("");
    const hoy = new Date().toISOString().slice(0, 10);
    const inicioMes = hoy.slice(0, 8) + "01";
    const [desde, setDesde] = useState(inicioMes);
    const [hasta, setHasta] = useState(hoy);
    const [filas, setFilas] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!empresaId) return;
        supabase.from("cuentas_empresa").select("id_cuenta, nombre, codigo")
            .eq("id_empresa", empresaId).eq("estado", true).order("codigo")
            .then(({ data }) => setCuentas(data || []));
    }, [empresaId]);

    const consultar = useCallback(async () => {
        if (!empresaId) return;
        setLoading(true);
        let q = supabase.from("libro_mayor").select("*")
            .eq("id_empresa", empresaId)
            .gte("fecha", desde).lte("fecha", hasta)
            .order("id_cuenta").order("fecha").order("id_movimiento");
        if (cuentaId) q = q.eq("id_cuenta", Number(cuentaId));
        const { data, error } = await q;
        if (error) toast.error("No se pudo cargar el libro mayor");
        setFilas(data || []);
        setLoading(false);
    }, [empresaId, cuentaId, desde, hasta]);

    useEffect(() => { consultar(); }, [consultar]);

    const totalDebe = filas.reduce((s, f) => s + Number(f.debe || 0), 0);
    const totalHaber = filas.reduce((s, f) => s + Number(f.haber || 0), 0);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
                <BookOpen className="text-title" size={26} />
                <div>
                    <h1 className="text-title text-2xl font-bold">Libro Mayor</h1>
                    <p className="text-subtitle text-sm">Movimientos por cuenta con saldo acumulado.</p>
                </div>
            </div>

            <div className="erp-card p-4 flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-subtitle text-xs">Cuenta</label>
                    <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}
                        className="bg-input text-title border border-secondary rounded-lg px-3 py-2 min-w-[240px]">
                        <option value="">Todas las cuentas</option>
                        {cuentas.map((c) => <option key={c.id_cuenta} value={c.id_cuenta}>{c.codigo} · {c.nombre}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-subtitle text-xs">Desde</label>
                    <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
                        className="bg-input text-title border border-secondary rounded-lg px-3 py-2" />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-subtitle text-xs">Hasta</label>
                    <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
                        className="bg-input text-title border border-secondary rounded-lg px-3 py-2" />
                </div>
                <button onClick={consultar} className="btn-primary"><Filter size={16} /> Filtrar</button>
            </div>

            <div className="erp-card p-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-subtitle text-left border-b border-secondary">
                            <th className="py-2 pr-4">Fecha</th>
                            <th className="py-2 pr-4">Cuenta</th>
                            <th className="py-2 pr-4">Comprobante</th>
                            <th className="py-2 pr-4">Descripción</th>
                            <th className="py-2 pr-4 text-right">Debe</th>
                            <th className="py-2 pr-4 text-right">Haber</th>
                            <th className="py-2 text-right">Saldo acum.</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={7} className="py-4 text-subtitle">Cargando…</td></tr>}
                        {filas.map((f) => (
                            <tr key={f.id_movimiento} className="border-b border-secondary/50">
                                <td className="py-2 pr-4 text-subtitle whitespace-nowrap">{f.fecha}</td>
                                <td className="py-2 pr-4 text-title">{f.codigo} · {f.cuenta}</td>
                                <td className="py-2 pr-4 text-subtitle">{f.numero_comprobante || "—"}</td>
                                <td className="py-2 pr-4 text-subtitle">{f.descripcion || "—"}</td>
                                <td className="py-2 pr-4 text-right text-emerald-400">{Number(f.debe) ? fmt(f.debe) : ""}</td>
                                <td className="py-2 pr-4 text-right text-red-400">{Number(f.haber) ? fmt(f.haber) : ""}</td>
                                <td className="py-2 text-right text-title font-medium">{fmt(f.saldo_acumulado)}</td>
                            </tr>
                        ))}
                        {!loading && filas.length === 0 && <tr><td colSpan={7} className="py-4 text-subtitle">Sin movimientos en el rango seleccionado.</td></tr>}
                    </tbody>
                    {filas.length > 0 && (
                        <tfoot>
                            <tr className="border-t-2 border-secondary font-bold text-title">
                                <td className="py-2 pr-4" colSpan={4}>Totales</td>
                                <td className="py-2 pr-4 text-right text-emerald-400">{fmt(totalDebe)}</td>
                                <td className="py-2 pr-4 text-right text-red-400">{fmt(totalHaber)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </div>
    );
}
