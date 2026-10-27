import { useState, useMemo } from "react";
import { ShoppingBag, Clock, CheckCircle2, PackageCheck, DollarSign, Phone, Mail, Truck, Store } from "lucide-react";
import { format } from "date-fns/format";
import Swal from "sweetalert2";
import StatsCards from "../components/statscards";
import Tabs from "../components/tabs";
import { usePedidosWeb } from "../hooks/usePedidosWeb";

const ESTADO_BADGE = {
  Pendiente: "bg-yellow-500/20 text-yellow-500",
  Confirmado: "bg-blue-500/20 text-blue-400",
  Listo: "bg-green-500/20 text-green-400",
  Entregado: "bg-emerald-600/20 text-emerald-400",
  Rechazado: "bg-red-500/20 text-red-400",
};

const PAGO_BADGE = {
  Pendiente: "bg-yellow-500/20 text-yellow-500",
  Simulado: "bg-blue-500/20 text-blue-400",
  Confirmado: "bg-green-500/20 text-green-400",
};

export default function PedidosWeb() {
  const { pedidos, isLoading, error, aceptarPedido, cambiarEstado, cambiarEstadoPago } = usePedidosWeb();
  const [activeTab, setActiveTab] = useState("activos");
  const [busqueda, setBusqueda] = useState("");

  const tabs = [
    { key: "activos", label: "Activos", icon: <Clock size={16} /> },
    { key: "historial", label: "Historial", icon: <PackageCheck size={16} /> },
  ];

  const { pendientes, listos, totalVentas } = useMemo(() => {
    const pend = pedidos.filter((p) => p.estado === "Pendiente").length;
    const list = pedidos.filter((p) => p.estado === "Listo").length;
    const total = pedidos
      .filter((p) => ["Listo", "Entregado"].includes(p.estado))
      .reduce((s, p) => s + Number(p.total || 0), 0);
    return { pendientes: pend, listos: list, totalVentas: total };
  }, [pedidos]);

  const visibles = useMemo(() => {
    let base;
    if (activeTab === "activos") {
      base = pedidos.filter((p) => ["Pendiente", "Confirmado", "Listo"].includes(p.estado));
    } else {
      base = pedidos.filter((p) => ["Entregado", "Rechazado"].includes(p.estado));
    }
    const q = busqueda.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) =>
      (p.numero_orden || "").toLowerCase().includes(q) ||
      (p.nombre_cliente || "").toLowerCase().includes(q) ||
      (p.telefono || "").toLowerCase().includes(q)
    );
  }, [pedidos, activeTab, busqueda]);

  const handleAceptar = async (pedido) => {
    const confirm = await Swal.fire({
      title: "¿Aceptar pedido?",
      html: `Se registrará la venta de <b>${pedido.nombre_cliente}</b> por <b>C$${Number(pedido.total).toFixed(2)}</b>, se descontará el inventario y el pedido pasará a <b>Listo para entregar</b>.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sí, aceptar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#16a34a",
      cancelButtonColor: "#6b7280",
    });
    if (!confirm.isConfirmed) return;

    const res = await aceptarPedido(pedido);
    if (res) {
      Swal.fire({ title: "¡Pedido aceptado!", text: "Venta registrada e inventario actualizado.", icon: "success", timer: 1600, showConfirmButton: false });
    } else {
      Swal.fire({ title: "Error", text: error || "No se pudo registrar la venta.", icon: "error" });
    }
  };

  const handleRechazar = async (pedido) => {
    const confirm = await Swal.fire({
      title: "¿Rechazar pedido?",
      text: "El pedido se marcará como rechazado. Esta acción no descuenta inventario.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, rechazar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!confirm.isConfirmed) return;
    await cambiarEstado(pedido.id_pedido, "Rechazado");
  };

  const handleEntregar = async (pedido) => {
    await cambiarEstado(pedido.id_pedido, "Entregado");
    Swal.fire({ title: "Entregado", icon: "success", timer: 1200, showConfirmButton: false });
  };

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatsCards title="Pedidos Web" icon={<ShoppingBag className="text-title" />} value={pedidos.length} />
        <StatsCards title="Pendientes" icon={<Clock color="#eab308" />} value={pendientes} />
        <StatsCards title="Listos p/ Entregar" icon={<CheckCircle2 color="#22c55e" />} value={listos} />
        <StatsCards title="Ventas Web" icon={<DollarSign className="text-title" />} value={`C$${totalVentas.toFixed(2)}`} />
      </div>

      <div className="mt-6">
        <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
        <div className="mt-8 border border-secondary rounded-2xl p-5">
          <div className="flex flex-col gap-1 mb-6">
            <h3 className="text-title text-xl font-bold">Bandeja de Pedidos en Línea</h3>
            <p className="text-subtitle text-s">Pedidos realizados por los clientes desde la tienda web.</p>
          </div>

          <div className="mb-6">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por N° de orden (P-0001), nombre o teléfono..."
              className="w-full md:max-w-md bg-secondary/40 border border-secondary rounded-lg px-4 py-2 text-title text-sm outline-none focus:border-title/60"
            />
          </div>

          {isLoading ? (
            <p className="text-center text-subtitle p-6">Cargando pedidos...</p>
          ) : visibles.length === 0 ? (
            <p className="text-center text-subtitle p-6">No hay pedidos en esta vista.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {visibles.map((p) => (
                <div key={p.id_pedido} className="border border-secondary rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-title font-bold">Orden {p.numero_orden || `P-${String(p.id_pedido).padStart(4, "0")}`}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTADO_BADGE[p.estado] || "bg-secondary text-subtitle"}`}>{p.estado}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PAGO_BADGE[p.estado_pago] || "bg-secondary text-subtitle"}`}>Pago: {p.estado_pago || "Pendiente"}</span>
                      </div>
                      <span className="text-subtitle text-sm">{p.created_at ? format(new Date(p.created_at), "dd/MM/yyyy HH:mm") : ""}</span>
                    </div>
                    <span className="text-title text-lg font-bold">C${Number(p.total || 0).toFixed(2)}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-subtitle">
                    <span className="text-title font-medium">{p.nombre_cliente}</span>
                    <span className="flex items-center gap-1"><Phone size={14} /> {p.telefono || "—"}</span>
                    {p.email && <span className="flex items-center gap-1"><Mail size={14} /> {p.email}</span>}
                    <span className="flex items-center gap-1">
                      {p.tipo_entrega === "domicilio" ? <Truck size={14} /> : <Store size={14} />}
                      {p.tipo_entrega || "retiro en tienda"} · {p.metodo_pago || "efectivo"}
                    </span>
                  </div>

                  {p.notas && <p className="text-subtitle text-sm italic">Nota: {p.notas}</p>}

                  <div className="border-t border-secondary/50 pt-2">
                    <table className="w-full text-sm text-subtitle">
                      <tbody>
                        {(p.pedidos_web_items || []).map((it) => (
                          <tr key={it.id_item}>
                            <td className="py-1">{it.nombre}</td>
                            <td className="py-1 text-center">x{it.cantidad}</td>
                            <td className="py-1 text-right">C${(Number(it.precio_unitario) * Number(it.cantidad)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-2 justify-end items-center">
                    <label className="text-subtitle text-sm">Estado de pago:</label>
                    <select
                      value={p.estado_pago || "Pendiente"}
                      onChange={(e) => cambiarEstadoPago(p.id_pedido, e.target.value)}
                      className="bg-input border border-secondary rounded-lg px-3 py-1.5 text-title text-sm outline-none focus:border-title/60"
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="Simulado">Simulado</option>
                      <option value="Confirmado">Confirmado</option>
                    </select>
                    {p.estado === "Pendiente" && (
                      <>
                        <button onClick={() => handleRechazar(p)} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer">Rechazar</button>
                        <button onClick={() => handleAceptar(p)} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-600/20 text-green-400 hover:bg-green-600/30 cursor-pointer">Aceptar y facturar</button>
                      </>
                    )}
                    {(p.estado === "Confirmado" || p.estado === "Listo") && (
                      <button onClick={() => handleEntregar(p)} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 cursor-pointer">Marcar entregado</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
