import { useState, useEffect, useCallback } from "react";
import { DoorOpen, DoorClosed, Wallet, Clock, Save, X, Calculator } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useAuth } from "../contexts/authcontext";
import { registrarAuditoria } from "../utils/auditoria";
import StatsCards from "../components/statscards";
import { format } from "date-fns/format";
import { toast } from "react-hot-toast";
import Swal from "sweetalert2";

const EMPRESA_ID = 1;

const fmt = (v) =>
  new Intl.NumberFormat("es-NI", { style: "currency", currency: "NIO", minimumFractionDigits: 2 })
    .format(v || 0)
    .replace("C$", "C$ ");

export default function AperturaCierre() {
  const { user, perfil, rol } = useAuth();
  const [cajaActual, setCajaActual] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [terminales, setTerminales] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [ventasPeriodo, setVentasPeriodo] = useState(0);
  const [historial, setHistorial] = useState([]);
  const [resumenCajas, setResumenCajas] = useState([]);

  // Los supervisores ven un resumen de las cajas del día de su sucursal.
  const esSupervisor = ["admin", "gerente", "superadmin"].includes(rol);

  // Modales
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [formAbrir, setFormAbrir] = useState({ monto_inicial: "", id_terminal: "", id_sucursal: "" });

  // Cierre de caja (arqueo)
  const [resumenCaja, setResumenCaja] = useState(null);
  const [cargandoResumen, setCargandoResumen] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [formCerrar, setFormCerrar] = useState({ contado_efectivo: "", monto_tarjeta: "", monto_transferencia: "", observaciones: "" });

  const calcularVentasPeriodo = useCallback(async (desde) => {
    // Suma de ventas en efectivo desde la apertura de caja
    const { data, error } = await supabase
      .from("ventas")
      .select("monto_total, fecha_venta, tipo_pago, created_at")
      .eq("id_empresa", EMPRESA_ID)
      .gte("fecha_venta", format(new Date(desde), "yyyy-MM-dd"));
    if (error) {
      console.error("Error calculando ventas:", error.message);
      return 0;
    }
    const total = (data || []).reduce((s, v) => s + Number(v.monto_total || 0), 0);
    return total;
  }, []);

  const cargar = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    // Caja abierta del cajero logueado
    const { data: caja } = await supabase
      .from("apertura_caja")
      .select("*, terminal:terminales_pos(nombre), sucursal:sucursales(nombre)")
      .eq("id_cajero", user.id)
      .eq("estado", "abierta")
      .order("fecha_apertura", { ascending: false })
      .maybeSingle();

    setCajaActual(caja || null);

    if (caja) {
      const v = await calcularVentasPeriodo(caja.fecha_apertura);
      setVentasPeriodo(v);
    } else {
      setVentasPeriodo(0);
    }

    // Catálogos para abrir
    const [{ data: term }, { data: suc }, { data: hist }] = await Promise.all([
      supabase.from("terminales_pos").select("id, nombre").eq("id_empresa", EMPRESA_ID).eq("estado", true),
      supabase.from("sucursales").select("id, nombre").eq("id_empresa", EMPRESA_ID).eq("estado", true),
      supabase
        .from("apertura_caja")
        .select("*, terminal:terminales_pos(nombre), sucursal:sucursales(nombre)")
        .eq("id_cajero", user.id)
        .order("fecha_apertura", { ascending: false })
        .limit(10),
    ]);
    setTerminales(term || []);
    setSucursales(suc || []);
    setHistorial(hist || []);

    // Resumen de cajas del día para supervisores (admin/gerente/superadmin)
    if (esSupervisor) {
      const inicioDia = format(new Date(), "yyyy-MM-dd") + "T00:00:00";
      let query = supabase
        .from("apertura_caja")
        .select("*, terminal:terminales_pos(nombre), sucursal:sucursales(nombre)")
        .eq("id_empresa", EMPRESA_ID)
        .gte("fecha_apertura", inicioDia)
        .order("fecha_apertura", { ascending: false });

      // admin/gerente limitados a su sucursal (si la tienen asignada); superadmin ve todas
      if (rol !== "superadmin" && perfil?.id_sucursal) {
        query = query.eq("id_sucursal", perfil.id_sucursal);
      }

      const [{ data: cajasDia }, { data: perfilesData }] = await Promise.all([
        query,
        supabase.from("perfiles").select("id, nombre_completo").eq("id_empresa", EMPRESA_ID),
      ]);

      const mapaNombres = {};
      (perfilesData || []).forEach((p) => { mapaNombres[p.id] = p.nombre_completo; });
      setResumenCajas((cajasDia || []).map((c) => ({
        ...c,
        cajero_nombre: mapaNombres[c.id_cajero] || "—",
      })));
    } else {
      setResumenCajas([]);
    }

    setIsLoading(false);
  }, [user, calcularVentasPeriodo, esSupervisor, rol, perfil]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirCaja = async (e) => {
    e.preventDefault();
    if (formAbrir.monto_inicial === "" || Number(formAbrir.monto_inicial) < 0) return toast.error("Ingrese un monto inicial válido.");
    if (!formAbrir.id_terminal) return toast.error("Seleccione una terminal.");
    if (!formAbrir.id_sucursal) return toast.error("Seleccione una sucursal.");
    const { error } = await supabase.from("apertura_caja").insert([
      {
        id_cajero: user.id,
        id_terminal: Number(formAbrir.id_terminal),
        id_sucursal: Number(formAbrir.id_sucursal),
        monto_inicial: Number(formAbrir.monto_inicial),
        estado: "abierta",
        id_empresa: EMPRESA_ID,
      },
    ]);
    if (error) return toast.error("Error al abrir caja: " + error.message);
    await registrarAuditoria(supabase, perfil, "ABRIR_CAJA", "Apertura/Cierre", `Abrió caja con ${fmt(formAbrir.monto_inicial)}`);
    toast.success("Caja abierta correctamente.");
    setModalAbrir(false);
    setFormAbrir({ monto_inicial: "", id_terminal: "", id_sucursal: "" });
    cargar();
  };

  const abrirModalCerrar = async () => {
    if (!cajaActual) return;
    setFormCerrar({ contado_efectivo: "", monto_tarjeta: "", monto_transferencia: "", observaciones: "" });
    setResumenCaja(null);
    setModalCerrar(true);
    setCargandoResumen(true);
    const { data, error } = await supabase.rpc("fn_resumen_caja", { p_id_apertura: cajaActual.id });
    if (error) {
      toast.error("Error al cargar resumen: " + error.message);
    } else {
      setResumenCaja(data || null);
    }
    setCargandoResumen(false);
  };

  const cerrarCaja = async () => {
    if (!cajaActual) return;
    if (formCerrar.contado_efectivo === "" || Number(formCerrar.contado_efectivo) < 0) {
      return toast.error("Ingrese el efectivo contado.");
    }
    setCerrando(true);
    const { data, error } = await supabase.rpc("sp_cerrar_caja", {
      p_id_apertura: cajaActual.id,
      p_contado_efectivo: Number(formCerrar.contado_efectivo),
      p_monto_tarjeta: Number(formCerrar.monto_tarjeta || 0),
      p_monto_transferencia: Number(formCerrar.monto_transferencia || 0),
      p_detalle: null,
      p_observaciones: formCerrar.observaciones || null,
    });
    setCerrando(false);
    if (error) return toast.error("Error al cerrar caja: " + error.message);

    const diferencia = Number(data?.diferencia || 0);
    await registrarAuditoria(supabase, perfil, "CERRAR_CAJA", "Apertura/Cierre", `Cerró caja. Diferencia: ${fmt(diferencia)}`);
    setModalCerrar(false);

    const esCuadre = Math.abs(diferencia) < 0.005;
    await Swal.fire({
      title: esCuadre ? "Caja cerrada y cuadrada" : diferencia > 0 ? "Caja cerrada — Sobrante" : "Caja cerrada — Faltante",
      html: esCuadre
        ? "El arqueo cuadró exactamente."
        : `Diferencia de <b>${fmt(Math.abs(diferencia))}</b> (${diferencia > 0 ? "sobrante" : "faltante"}).`,
      icon: esCuadre ? "success" : "warning",
      confirmButtonColor: "#2563eb",
      background: "#152235",
      color: "#e5e7eb",
    });
    cargar();
  };

  const montoEsperado = cajaActual ? Number(cajaActual.monto_inicial) + Number(ventasPeriodo) : 0;

  // Efectivo esperado según el resumen de la BD (fallback al cálculo local)
  const efectivoEsperado = resumenCaja ? Number(resumenCaja.efectivo_esperado || 0) : montoEsperado;
  const diferenciaViva = (Number(formCerrar.contado_efectivo || 0)) - efectivoEsperado;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <StatsCards
          title={"Estado de Caja"}
          icon={cajaActual ? <DoorOpen className="text-green-400" /> : <DoorClosed className="text-red-400" />}
          value={cajaActual ? "Abierta" : "Cerrada"}
        />
        <StatsCards title={"Monto Inicial"} icon={<Wallet className="text-title" />} value={fmt(cajaActual?.monto_inicial)} />
        <StatsCards title={"Ventas del Período"} icon={<Calculator className="text-blue-400" />} value={fmt(ventasPeriodo)} />
      </div>

      <div className="mt-8 border border-secondary rounded-2xl p-5">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title text-xl font-bold">Apertura y Cierre de Caja</h3>
            <p className="text-subtitle text-s">Gestiona el arqueo de caja del cajero</p>
          </div>
          {isLoading ? null : cajaActual ? (
            <button onClick={abrirModalCerrar} className="bg-red-600 text-white flex flex-row h-10 gap-3 p-2 rounded-xl items-center cursor-pointer hover:scale-110 transition">
              <DoorClosed /> Cerrar Caja
            </button>
          ) : (
            <button onClick={() => setModalAbrir(true)} className="bg-button text-button flex flex-row h-10 gap-3 p-2 rounded-xl items-center cursor-pointer hover:scale-110 transition">
              <DoorOpen /> Abrir Caja
            </button>
          )}
        </div>

        {cajaActual && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-title">
            <div className="bg-secondary/40 rounded-xl p-4 border border-secondary">
              <p className="text-subtitle text-sm flex items-center gap-2"><Clock size={16} /> Apertura</p>
              <p className="font-semibold">{format(new Date(cajaActual.fecha_apertura), "dd/MM/yyyy HH:mm")}</p>
            </div>
            <div className="bg-secondary/40 rounded-xl p-4 border border-secondary">
              <p className="text-subtitle text-sm">Terminal / Sucursal</p>
              <p className="font-semibold">{cajaActual.terminal?.nombre || "—"} · {cajaActual.sucursal?.nombre || "—"}</p>
            </div>
            <div className="bg-secondary/40 rounded-xl p-4 border border-secondary">
              <p className="text-subtitle text-sm">Monto inicial</p>
              <p className="font-semibold">{fmt(cajaActual.monto_inicial)}</p>
            </div>
            <div className="bg-secondary/40 rounded-xl p-4 border border-secondary">
              <p className="text-subtitle text-sm">Monto esperado en caja</p>
              <p className="font-semibold text-green-400">{fmt(montoEsperado)}</p>
            </div>
          </div>
        )}

        {/* Historial */}
        <div className="mt-8 overflow-x-auto">
          <h4 className="text-title font-semibold mb-3">Historial reciente</h4>
          {historial.length === 0 ? (
            <p className="text-subtitle p-4 text-center">Sin registros de caja.</p>
          ) : (
            <table className="text-title w-full border-collapse">
              <thead>
                <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                  <th className="py-3 px-2 text-left">Apertura</th>
                  <th className="py-3 px-2 text-left">Cierre</th>
                  <th className="py-3 px-2 text-center">Inicial</th>
                  <th className="py-3 px-2 text-center">Cierre (C$)</th>
                  <th className="py-3 px-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.map((h) => (
                  <tr key={h.id} className="border-t border-secondary text-sm hover:bg-secondary transition-colors">
                    <td className="py-3 px-2">{format(new Date(h.fecha_apertura), "dd/MM/yyyy HH:mm")}</td>
                    <td className="py-3 px-2">{h.fecha_cierre ? format(new Date(h.fecha_cierre), "dd/MM/yyyy HH:mm") : "—"}</td>
                    <td className="py-3 px-2 text-center">{fmt(h.monto_inicial)}</td>
                    <td className="py-3 px-2 text-center">{h.monto_cierre != null ? fmt(h.monto_cierre) : "—"}</td>
                    <td className="py-3 px-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${h.estado === "abierta" ? "bg-green-600/20 text-green-400" : "bg-gray-600/20 text-gray-300"}`}>
                        {h.estado === "abierta" ? "Abierta" : "Cerrada"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Resumen de cajas del día (supervisores) */}
      {esSupervisor && (
        <div className="mt-8 border border-secondary rounded-2xl p-5">
          <div className="flex flex-col gap-1 mb-4">
            <h3 className="text-title text-xl font-bold">Resumen de Cajas del Día</h3>
            <p className="text-subtitle text-s">
              {rol === "superadmin"
                ? "Todas las cajas abiertas y cerradas hoy en la empresa"
                : "Cajas de tu sucursal abiertas y cerradas hoy"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <StatsCards title={"Cajas Abiertas"} icon={<DoorOpen className="text-green-400" />} value={resumenCajas.filter(c => c.estado === "abierta").length} />
            <StatsCards title={"Cajas Cerradas"} icon={<DoorClosed className="text-red-400" />} value={resumenCajas.filter(c => c.estado === "cerrada").length} />
            <StatsCards title={"Total Cierres (C$)"} icon={<Calculator className="text-blue-400" />} value={fmt(resumenCajas.reduce((s, c) => s + Number(c.monto_cierre || 0), 0))} />
          </div>

          <div className="overflow-x-auto">
            {resumenCajas.length === 0 ? (
              <p className="text-subtitle p-4 text-center">No hay cajas registradas hoy.</p>
            ) : (
              <table className="text-title w-full border-collapse">
                <thead>
                  <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                    <th className="py-3 px-2 text-left">Cajero</th>
                    <th className="py-3 px-2 text-left">Terminal / Sucursal</th>
                    <th className="py-3 px-2 text-left">Apertura</th>
                    <th className="py-3 px-2 text-left">Cierre</th>
                    <th className="py-3 px-2 text-center">Inicial</th>
                    <th className="py-3 px-2 text-center">Cierre (C$)</th>
                    <th className="py-3 px-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {resumenCajas.map((c) => (
                    <tr key={c.id} className="border-t border-secondary text-sm hover:bg-secondary transition-colors">
                      <td className="py-3 px-2 font-medium">{c.cajero_nombre}</td>
                      <td className="py-3 px-2 text-subtitle">{c.terminal?.nombre || "—"} · {c.sucursal?.nombre || "—"}</td>
                      <td className="py-3 px-2">{format(new Date(c.fecha_apertura), "dd/MM/yyyy HH:mm")}</td>
                      <td className="py-3 px-2">{c.fecha_cierre ? format(new Date(c.fecha_cierre), "dd/MM/yyyy HH:mm") : "—"}</td>
                      <td className="py-3 px-2 text-center">{fmt(c.monto_inicial)}</td>
                      <td className="py-3 px-2 text-center">{c.monto_cierre != null ? fmt(c.monto_cierre) : "—"}</td>
                      <td className="py-3 px-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${c.estado === "abierta" ? "bg-green-600/20 text-green-400" : "bg-gray-600/20 text-gray-300"}`}>
                          {c.estado === "abierta" ? "Abierta" : "Cerrada"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Modal Abrir Caja */}
      {modalAbrir && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setModalAbrir(false)}></div>
          <div className="relative z-10 mx-4 bg-primary text-title p-8 rounded-2xl w-full max-w-lg shadow-lg border border-secondary">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Abrir Caja</h3>
              <button onClick={() => setModalAbrir(false)} className="text-subtitle hover:text-title"><X /></button>
            </div>
            <form onSubmit={abrirCaja} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Monto Inicial (C$) *</label>
                <input type="number" step="0.01" value={formAbrir.monto_inicial} onChange={(e) => setFormAbrir({ ...formAbrir, monto_inicial: e.target.value })} placeholder="0.00" className="bg-input border border-secondary rounded-lg p-3" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Terminal *</label>
                <select value={formAbrir.id_terminal} onChange={(e) => setFormAbrir({ ...formAbrir, id_terminal: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  <option value="">Seleccione una terminal</option>
                  {terminales.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium">Sucursal *</label>
                <select value={formAbrir.id_sucursal} onChange={(e) => setFormAbrir({ ...formAbrir, id_sucursal: e.target.value })} className="bg-input border border-secondary rounded-lg p-3">
                  <option value="">Seleccione una sucursal</option>
                  {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-4 mt-4">
                <button type="button" onClick={() => setModalAbrir(false)} className="cursor-pointer bg-secondary border border-secondary font-semibold py-2 px-6 rounded-lg hover:scale-105 transition">Cancelar</button>
                <button type="submit" className="cursor-pointer bg-button text-button font-semibold py-2 px-4 rounded-lg hover:scale-105 transition flex gap-2 items-center"><Save size={18} /> Abrir</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cerrar Caja */}
      {modalCerrar && cajaActual && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setModalCerrar(false)}></div>
          <div className="relative z-10 mx-4 bg-primary text-title p-8 rounded-2xl w-full max-w-lg shadow-lg border border-secondary">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-semibold">Cerrar Caja — Arqueo</h3>
              <button onClick={() => setModalCerrar(false)} className="text-subtitle hover:text-title"><X /></button>
            </div>

            {cargandoResumen ? (
              <p className="text-subtitle text-center py-6">Cargando resumen de caja...</p>
            ) : (
              <>
                {/* Resumen del período (fn_resumen_caja) */}
                <div className="bg-secondary/40 rounded-xl p-4 border border-secondary mb-4 text-sm">
                  <p className="text-subtitle font-semibold mb-2 flex items-center gap-2"><Calculator size={16} /> Resumen del período</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-title">
                    <span className="text-subtitle">Monto inicial</span><span className="text-right font-medium">{fmt(resumenCaja?.monto_inicial ?? cajaActual.monto_inicial)}</span>
                    <span className="text-subtitle">Ventas efectivo</span><span className="text-right font-medium">{fmt(resumenCaja?.ventas_efectivo)}</span>
                    <span className="text-subtitle">Ventas tarjeta</span><span className="text-right font-medium">{fmt(resumenCaja?.ventas_tarjeta)}</span>
                    <span className="text-subtitle">Ventas transferencia</span><span className="text-right font-medium">{fmt(resumenCaja?.ventas_transferencia)}</span>
                    <span className="text-subtitle">Ventas crédito</span><span className="text-right font-medium">{fmt(resumenCaja?.ventas_credito)}</span>
                    <span className="text-subtitle">Devoluciones efectivo</span><span className="text-right font-medium">{fmt(resumenCaja?.devoluciones_efectivo)}</span>
                    <span className="text-title font-semibold border-t border-secondary pt-1 mt-1">Efectivo esperado</span>
                    <span className="text-right font-bold text-green-400 border-t border-secondary pt-1 mt-1">{fmt(efectivoEsperado)}</span>
                  </div>
                </div>

                {/* Arqueo (conteo) */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-title">Efectivo contado (C$) *</label>
                    <input type="number" step="0.01" value={formCerrar.contado_efectivo} onChange={(e) => setFormCerrar({ ...formCerrar, contado_efectivo: e.target.value })} placeholder="0.00" className="bg-input border border-secondary rounded-lg p-3 text-title" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-title">Tarjeta (C$)</label>
                      <input type="number" step="0.01" value={formCerrar.monto_tarjeta} onChange={(e) => setFormCerrar({ ...formCerrar, monto_tarjeta: e.target.value })} placeholder="0.00" className="bg-input border border-secondary rounded-lg p-3 text-title" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-title">Transferencia (C$)</label>
                      <input type="number" step="0.01" value={formCerrar.monto_transferencia} onChange={(e) => setFormCerrar({ ...formCerrar, monto_transferencia: e.target.value })} placeholder="0.00" className="bg-input border border-secondary rounded-lg p-3 text-title" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-title">Observaciones</label>
                    <textarea value={formCerrar.observaciones} onChange={(e) => setFormCerrar({ ...formCerrar, observaciones: e.target.value })} rows={2} placeholder="Opcional" className="bg-input border border-secondary rounded-lg p-3 text-title resize-none" />
                  </div>

                  {/* Diferencia en vivo */}
                  <div className={`flex justify-between items-center rounded-xl p-3 border ${Math.abs(diferenciaViva) < 0.005 ? "border-green-500/40 bg-green-500/10" : diferenciaViva > 0 ? "border-blue-500/40 bg-blue-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                    <span className="font-semibold text-title">Diferencia</span>
                    <span className={`font-bold ${Math.abs(diferenciaViva) < 0.005 ? "text-green-400" : diferenciaViva > 0 ? "text-blue-400" : "text-red-400"}`}>
                      {fmt(diferenciaViva)} {Math.abs(diferenciaViva) < 0.005 ? "(cuadra)" : diferenciaViva > 0 ? "(sobrante)" : "(faltante)"}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-4 mt-6">
                  <button type="button" onClick={() => setModalCerrar(false)} className="cursor-pointer bg-secondary border border-secondary font-semibold py-2 px-6 rounded-lg hover:scale-105 transition">Cancelar</button>
                  <button onClick={cerrarCaja} disabled={cerrando} className="cursor-pointer bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:scale-105 transition flex gap-2 items-center disabled:opacity-50"><DoorClosed size={18} /> {cerrando ? "Cerrando..." : "Confirmar Cierre"}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
