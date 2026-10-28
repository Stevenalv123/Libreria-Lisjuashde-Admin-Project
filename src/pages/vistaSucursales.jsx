import { useState, useEffect, useCallback } from "react";
import {
  Building2, DollarSign, CalendarDays, Package, DoorOpen,
  Users, ShoppingBag, AlertTriangle, X, ArrowRight,
} from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useAuth } from "../contexts/authcontext";
import StatsCards from "../components/statscards";
import { toast } from "react-hot-toast";

const EMPRESA_ID = 1;
const fmt = (v) => `C$ ${Number(v || 0).toFixed(2)}`;
const PENDIENTES_WEB = ["Pendiente", "En preparación", "Listo"];

export default function VistaSucursales() {
  const { rol } = useAuth();
  const [sucursales, setSucursales] = useState([]);
  const [kpis, setKpis] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [detalle, setDetalle] = useState(null); // sucursal seleccionada

  const hoy = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  const inicioMesStr = inicioMes.toISOString().slice(0, 10);

  const cargar = useCallback(async () => {
    setIsLoading(true);
    const [
      { data: sucs },
      { data: ventas },
      { data: cajas },
      { data: perfiles },
      { data: pedidos },
      { data: stock },
    ] = await Promise.all([
      supabase.from("sucursales").select("id, nombre, direccion, telefono").eq("id_empresa", EMPRESA_ID).eq("estado", true).order("id"),
      supabase.from("ventas").select("monto_total, fecha_venta, id_sucursal").eq("id_empresa", EMPRESA_ID).gte("fecha_venta", inicioMesStr),
      supabase.from("apertura_caja").select("id_sucursal, estado").eq("id_empresa", EMPRESA_ID).eq("estado", "abierta"),
      supabase.from("perfiles").select("id_sucursal, activo").eq("id_empresa", EMPRESA_ID),
      supabase.from("pedidos_web").select("id_sucursal, estado"),
      supabase.from("v_stock_sucursal").select("id_sucursal, stock, stock_minimo, precio_venta"),
    ]);

    const porSuc = {};
    (sucs || []).forEach((s) => {
      porSuc[s.id] = { ventasHoy: 0, ventasMes: 0, valorInv: 0, cajasAbiertas: 0, personal: 0, pedidosPend: 0, stockBajo: 0 };
    });
    (ventas || []).forEach((v) => {
      const k = porSuc[v.id_sucursal];
      if (!k) return;
      const monto = Number(v.monto_total || 0);
      k.ventasMes += monto;
      if ((v.fecha_venta || "").slice(0, 10) === hoy) k.ventasHoy += monto;
    });
    (cajas || []).forEach((c) => { if (porSuc[c.id_sucursal]) porSuc[c.id_sucursal].cajasAbiertas += 1; });
    (perfiles || []).forEach((p) => { if (porSuc[p.id_sucursal] && p.activo !== false) porSuc[p.id_sucursal].personal += 1; });
    (pedidos || []).forEach((p) => { if (porSuc[p.id_sucursal] && PENDIENTES_WEB.includes(p.estado)) porSuc[p.id_sucursal].pedidosPend += 1; });
    (stock || []).forEach((s) => {
      const k = porSuc[s.id_sucursal];
      if (!k) return;
      k.valorInv += Number(s.stock || 0) * Number(s.precio_venta || 0);
      if (Number(s.stock || 0) <= Number(s.stock_minimo || 0)) k.stockBajo += 1;
    });

    setSucursales(sucs || []);
    setKpis(porSuc);
    setIsLoading(false);
  }, [hoy, inicioMesStr]);

  useEffect(() => { cargar(); }, [cargar]);

  if (rol !== "superadmin") {
    return (
      <div className="erp-card p-8 text-center mt-6">
        <AlertTriangle className="mx-auto text-amber-400 mb-3" size={40} />
        <h3 className="text-title text-lg font-bold">Acceso restringido</h3>
        <p className="text-subtitle">Esta vista global solo está disponible para el super administrador.</p>
      </div>
    );
  }

  // Totales
  const tot = Object.values(kpis).reduce((a, k) => ({
    ventasHoy: a.ventasHoy + k.ventasHoy,
    ventasMes: a.ventasMes + k.ventasMes,
    valorInv: a.valorInv + k.valorInv,
    cajasAbiertas: a.cajasAbiertas + k.cajasAbiertas,
    personal: a.personal + k.personal,
    pedidosPend: a.pedidosPend + k.pedidosPend,
    stockBajo: a.stockBajo + k.stockBajo,
  }), { ventasHoy: 0, ventasMes: 0, valorInv: 0, cajasAbiertas: 0, personal: 0, pedidosPend: 0, stockBajo: 0 });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mt-2 mb-5">
        <Building2 className="text-title" size={26} />
        <div>
          <h2 className="text-title text-2xl font-bold">Vista global de sucursales</h2>
          <p className="text-subtitle text-sm">Resumen consolidado de todas las sucursales de Librería Lisjuashde.</p>
        </div>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCards title="Ventas de hoy (total)" icon={<DollarSign className="text-title" />} value={fmt(tot.ventasHoy)} color="green" />
        <StatsCards title="Ventas del mes (total)" icon={<CalendarDays className="text-title" />} value={fmt(tot.ventasMes)} color="blue" />
        <StatsCards title="Valor inventario (total)" icon={<Package className="text-title" />} value={fmt(tot.valorInv)} color="purple" />
        <StatsCards title="Pedidos web pendientes" icon={<ShoppingBag className="text-title" />} value={tot.pedidosPend} color="orange" />
      </div>

      {isLoading ? (
        <p className="text-subtitle text-center py-10">Cargando información de sucursales...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {sucursales.map((s) => {
            const k = kpis[s.id] || {};
            return (
              <div key={s.id} className="erp-card erp-card-hover p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-input rounded-xl p-2.5"><Building2 className="text-title" /></div>
                    <div>
                      <h3 className="text-title text-lg font-bold">{s.nombre}</h3>
                      <p className="text-subtitle text-xs">{s.direccion || "—"}{s.telefono ? ` · Tel. ${s.telefono}` : ""}</p>
                    </div>
                  </div>
                  <button onClick={() => setDetalle(s)} className="btn-secondary text-sm whitespace-nowrap">
                    Ver detalle <ArrowRight size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Mini label="Ventas hoy" value={fmt(k.ventasHoy)} icon={<DollarSign size={15} />} />
                  <Mini label="Ventas mes" value={fmt(k.ventasMes)} icon={<CalendarDays size={15} />} />
                  <Mini label="Valor inventario" value={fmt(k.valorInv)} icon={<Package size={15} />} />
                  <Mini label="Cajas abiertas" value={k.cajasAbiertas} icon={<DoorOpen size={15} />} />
                  <Mini label="Personal activo" value={k.personal} icon={<Users size={15} />} />
                  <Mini label="Pedidos web pend." value={k.pedidosPend} icon={<ShoppingBag size={15} />} />
                  <Mini label="Stock bajo" value={k.stockBajo} icon={<AlertTriangle size={15} />} alerta={k.stockBajo > 0} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detalle && <DetalleSucursal sucursal={detalle} onClose={() => setDetalle(null)} />}
    </div>
  );
}

const Mini = ({ label, value, icon, alerta }) => (
  <div className={`rounded-xl p-3 border ${alerta ? "border-red-500/40 bg-red-500/10" : "border-secondary bg-input/50"}`}>
    <p className="text-subtitle text-[0.7rem] flex items-center gap-1">{icon} {label}</p>
    <p className={`font-bold mt-0.5 ${alerta ? "text-red-400" : "text-title"}`}>{value}</p>
  </div>
);

// --- Detalle (drill-down) de una sucursal ---
function DetalleSucursal({ sucursal, onClose }) {
  const [ventas, setVentas] = useState([]);
  const [stockBajo, setStockBajo] = useState([]);
  const [personal, setPersonal] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: v }, { data: st }, { data: p }, { data: c }] = await Promise.all([
        supabase.from("ventas").select("id_venta, numero_factura, monto_total, fecha_venta, canal").eq("id_sucursal", sucursal.id).order("fecha_venta", { ascending: false }).limit(8),
        supabase.from("v_stock_sucursal").select("nombre, stock, stock_minimo").eq("id_sucursal", sucursal.id),
        supabase.from("perfiles").select("nombre_completo, rol").eq("id_sucursal", sucursal.id).eq("activo", true),
        supabase.from("apertura_caja").select("id, monto_inicial, fecha_apertura").eq("id_sucursal", sucursal.id).eq("estado", "abierta"),
      ]);
      setVentas(v || []);
      setStockBajo((st || []).filter((x) => Number(x.stock || 0) <= Number(x.stock_minimo || 0)).slice(0, 10));
      setPersonal(p || []);
      setCajas(c || []);
      setLoading(false);
    })().catch(() => { toast.error("Error cargando el detalle."); setLoading(false); });
  }, [sucursal]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative z-10 bg-card text-title p-7 rounded-2xl w-full max-w-3xl shadow-lg border border-secondary max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2"><Building2 size={20} /> {sucursal.nombre}</h3>
            <p className="text-subtitle text-sm">{sucursal.direccion || "—"}{sucursal.telefono ? ` · Tel. ${sucursal.telefono}` : ""}</p>
          </div>
          <button onClick={onClose} className="text-subtitle hover:text-title"><X /></button>
        </div>

        {loading ? (
          <p className="text-subtitle text-center py-8">Cargando detalle...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="erp-card p-4">
              <h4 className="text-title font-semibold mb-3 flex items-center gap-2"><DollarSign size={16} /> Ventas recientes</h4>
              {ventas.length === 0 ? <p className="text-subtitle text-sm">Sin ventas.</p> : (
                <ul className="flex flex-col gap-2">
                  {ventas.map((v) => (
                    <li key={v.id_venta} className="flex justify-between text-sm border-b border-secondary/40 pb-1.5">
                      <span className="text-subtitle">{v.numero_factura || `#${v.id_venta}`} <span className="text-[0.7rem]">({v.canal === "web" ? "Web" : "Sucursal"})</span></span>
                      <span className="text-title font-medium">{fmt(v.monto_total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="erp-card p-4">
              <h4 className="text-title font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={16} /> Stock bajo</h4>
              {stockBajo.length === 0 ? <p className="text-subtitle text-sm">Sin productos en stock bajo.</p> : (
                <ul className="flex flex-col gap-2">
                  {stockBajo.map((x, i) => (
                    <li key={i} className="flex justify-between text-sm border-b border-secondary/40 pb-1.5">
                      <span className="text-subtitle truncate pr-2">{x.nombre}</span>
                      <span className="text-red-400 font-medium whitespace-nowrap">{x.stock} / {x.stock_minimo}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="erp-card p-4">
              <h4 className="text-title font-semibold mb-3 flex items-center gap-2"><Users size={16} /> Personal activo ({personal.length})</h4>
              {personal.length === 0 ? <p className="text-subtitle text-sm">Sin personal asignado.</p> : (
                <ul className="flex flex-col gap-2">
                  {personal.map((p, i) => (
                    <li key={i} className="flex justify-between text-sm border-b border-secondary/40 pb-1.5">
                      <span className="text-subtitle">{p.nombre_completo}</span>
                      <span className="badge badge-neutral">{p.rol}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="erp-card p-4">
              <h4 className="text-title font-semibold mb-3 flex items-center gap-2"><DoorOpen size={16} /> Cajas abiertas ({cajas.length})</h4>
              {cajas.length === 0 ? <p className="text-subtitle text-sm">No hay cajas abiertas.</p> : (
                <ul className="flex flex-col gap-2">
                  {cajas.map((c) => (
                    <li key={c.id} className="flex justify-between text-sm border-b border-secondary/40 pb-1.5">
                      <span className="text-subtitle">{new Date(c.fecha_apertura).toLocaleString("es-NI")}</span>
                      <span className="text-title font-medium">{fmt(c.monto_inicial)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
