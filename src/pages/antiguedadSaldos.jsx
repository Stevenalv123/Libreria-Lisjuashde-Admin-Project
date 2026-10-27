import { useState, useEffect, useCallback } from "react";
import { Clock, Users, Truck, RefreshCw } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import Tabs from "../components/tabs";
import StatsCards from "../components/statscards";
import { toast } from "react-hot-toast";

const fmt = (n) => `C$ ${Number(n || 0).toLocaleString("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tramoColor = (t) => {
    const s = (t || "").toLowerCase();
    if (s.includes("corriente") || s.includes("0")) return "bg-emerald-500/15 text-emerald-400";
    if (s.includes("1-30") || s.includes("1 - 30")) return "bg-amber-500/15 text-amber-400";
    if (s.includes("31-60") || s.includes("31 - 60")) return "bg-orange-500/15 text-orange-400";
    return "bg-red-500/15 text-red-400";
};

export default function AntiguedadSaldos() {
    const tabs = [
        { key: "cxc", label: "Cuentas por Cobrar", icon: <Users size={16} /> },
        { key: "cxp", label: "Cuentas por Pagar", icon: <Truck size={16} /> },
    ];
    const [tab, setTab] = useState("cxc");
    const [cxc, setCxc] = useState([]);
    const [cxp, setCxp] = useState([]);
    const [loading, setLoading] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        const [{ data: c1 }, { data: c2 }] = await Promise.all([
            supabase.from("antiguedad_cxc").select("*").order("dias_vencido", { ascending: false }),
            supabase.from("antiguedad_cxp").select("*").order("dias_vencido", { ascending: false }),
        ]);
        setCxc(c1 || []);
        setCxp(c2 || []);
        setLoading(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const datos = tab === "cxc" ? cxc : cxp;
    const totalPendiente = datos.reduce((s, r) => s + Number(r.saldo_pendiente || 0), 0);
    const totalVencido = datos.filter((r) => Number(r.dias_vencido) > 0).reduce((s, r) => s + Number(r.saldo_pendiente || 0), 0);

    return (
        <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <Clock className="text-title" size={26} />
                    <div>
                        <h1 className="text-title text-2xl font-bold">Antigüedad de Saldos</h1>
                        <p className="text-subtitle text-sm">Cuentas por cobrar y por pagar por tramos de vencimiento.</p>
                    </div>
                </div>
                <button onClick={cargar} className="btn-secondary"><RefreshCw size={16} /> Actualizar</button>
            </div>

            <Tabs tabs={tabs} activeKey={tab} onChange={setTab} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatsCards title="Documentos" value={datos.length} icon={<Clock size={20} />} color="blue" />
                <StatsCards title="Saldo pendiente total" value={fmt(totalPendiente)} icon={<Users size={20} />} color="purple" />
                <StatsCards title="Saldo vencido" value={fmt(totalVencido)} icon={<Truck size={20} />} color="red" />
            </div>

            <div className="erp-card p-4 overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-subtitle text-left border-b border-secondary">
                            {tab === "cxc" ? (
                                <><th className="py-2 pr-4">Factura</th><th className="py-2 pr-4">Cliente</th></>
                            ) : (
                                <><th className="py-2 pr-4">Compra</th><th className="py-2 pr-4">Proveedor</th></>
                            )}
                            <th className="py-2 pr-4">Fecha</th>
                            <th className="py-2 pr-4">Vence</th>
                            <th className="py-2 pr-4 text-right">Total</th>
                            <th className="py-2 pr-4 text-right">Pendiente</th>
                            <th className="py-2 pr-4 text-right">Días</th>
                            <th className="py-2">Tramo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && <tr><td colSpan={8} className="py-4 text-subtitle">Cargando…</td></tr>}
                        {datos.map((r) => (
                            <tr key={tab === "cxc" ? r.id_venta : r.id_compra} className="border-b border-secondary/50">
                                {tab === "cxc" ? (
                                    <><td className="py-2 pr-4 text-title font-medium">{r.numero_factura || r.id_venta}</td><td className="py-2 pr-4 text-subtitle">{r.cliente}</td></>
                                ) : (
                                    <><td className="py-2 pr-4 text-title font-medium">#{r.id_compra}</td><td className="py-2 pr-4 text-subtitle">{r.proveedor}</td></>
                                )}
                                <td className="py-2 pr-4 text-subtitle whitespace-nowrap">{tab === "cxc" ? r.fecha_venta : r.fecha_compra}</td>
                                <td className="py-2 pr-4 text-subtitle whitespace-nowrap">{r.fecha_vencimiento || "—"}</td>
                                <td className="py-2 pr-4 text-right text-subtitle">{fmt(r.monto_total)}</td>
                                <td className="py-2 pr-4 text-right text-title font-medium">{fmt(r.saldo_pendiente)}</td>
                                <td className="py-2 pr-4 text-right text-subtitle">{r.dias_vencido}</td>
                                <td className="py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${tramoColor(r.tramo)}`}>{r.tramo}</span></td>
                            </tr>
                        ))}
                        {!loading && datos.length === 0 && <tr><td colSpan={8} className="py-4 text-subtitle">Sin saldos pendientes.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
