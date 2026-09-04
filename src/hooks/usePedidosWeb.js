import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

// Mapea el método de pago del pedido web al valor que espera sp_registrar_venta.
const mapTipoPago = (metodo) => {
  if (!metodo) return "efectivo";
  const m = metodo.toLowerCase();
  if (m.includes("tarjeta")) return "tarjeta de credito";
  if (m.includes("transfer")) return "transferencia bancaria";
  if (m.includes("credito") || m.includes("crédito")) return "credito";
  return "efectivo";
};

export function usePedidosWeb() {
  const { empresaId } = useEmpresa();
  const [pedidos, setPedidos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPedidos = useCallback(async () => {
    if (!empresaId) {
      setPedidos([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("pedidos_web")
        .select(
          "id_pedido, numero_orden, id_empresa, user_id, nombre_cliente, telefono, email, total, metodo_pago, tipo_entrega, notas, estado, id_venta, created_at, pedidos_web_items ( id_item, id_producto, nombre, cantidad, precio_unitario, imagen )"
        )
        .eq("id_empresa", empresaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (err) {
      console.error("Error cargando pedidos web:", err.message);
      setError(err.message);
      setPedidos([]);
    } finally {
      setIsLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    fetchPedidos();
  }, [fetchPedidos]);

  // Actualiza únicamente el estado del pedido (Confirmar/Listo/Entregado/Rechazado).
  const cambiarEstado = async (idPedido, nuevoEstado) => {
    try {
      const { error } = await supabase
        .from("pedidos_web")
        .update({ estado: nuevoEstado })
        .eq("id_pedido", idPedido);
      if (error) throw error;
      await fetchPedidos();
      return true;
    } catch (err) {
      console.error("Error actualizando pedido:", err.message);
      setError(err.message);
      return false;
    }
  };

  // Acepta el pedido: registra la venta contable (descuenta inventario) y marca "Listo".
  const aceptarPedido = async (pedido) => {
    setIsLoading(true);
    setError(null);
    try {
      const items = (pedido.pedidos_web_items || [])
        .filter((it) => it.id_producto) // sólo productos del catálogo
        .map((it) => ({ IdProducto: Number(it.id_producto), Cantidad: Number(it.cantidad) }));

      if (items.length === 0) {
        throw new Error("El pedido no tiene productos válidos del catálogo para facturar.");
      }

      const numeroFactura = `WEB-${pedido.id_pedido}-${Date.now().toString().slice(-5)}`;

      const { data: idVenta, error: rpcError } = await supabase.rpc("sp_registrar_venta", {
        p_id_empresa: empresaId,
        p_id_cliente: 1, // Público General
        p_tipo_pago: mapTipoPago(pedido.metodo_pago),
        p_detalle_ventas: items,
        p_numero_factura: numeroFactura,
        p_fecha_vencimiento: null,
        p_plazo_dias: 0,
      });

      if (rpcError) throw rpcError;

      const { error: updError } = await supabase
        .from("pedidos_web")
        .update({ estado: "Listo", id_venta: idVenta })
        .eq("id_pedido", pedido.id_pedido);
      if (updError) throw updError;

      await fetchPedidos();
      return idVenta;
    } catch (err) {
      console.error("Error aceptando pedido:", err.message);
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { pedidos, isLoading, error, fetchPedidos, cambiarEstado, aceptarPedido };
}
