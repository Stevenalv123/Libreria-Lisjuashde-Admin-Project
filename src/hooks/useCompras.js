import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";
import { data } from "react-router-dom";

export function useCompras() {
    const { empresaId } = useEmpresa();
    const [compras, setCompras] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fetchCompras = useCallback(async () => {
        if (!empresaId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase.rpc('sp_get_compras', {
                p_id_empresa: empresaId
            });
            if (error) throw error;
            setCompras(data || []);
        } catch (error) {
            toast.error(`Error al cargar compras: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [empresaId]);

    useEffect(() => {
        fetchCompras();
    }, [fetchCompras]);

    const registrarCompra = async (compraData) => {
        setIsSaving(true);
        try {
            const { data: nuevaCompraId, error } = await supabase.rpc('sp_registrar_compra', {
                p_id_empresa: empresaId,
                p_id_proveedor: compraData.id_proveedor,
                p_tipo_pago: compraData.tipo_pago,
                p_detalle_compra: compraData.detalle_compra,
                p_fecha_compra: compraData.fecha_compra
            });
            if (error) throw error;
            toast.success(`✅ Compra registrada (ID: ${nuevaCompraId})`);
            await fetchCompras();
            return { success: true };
        } catch (error) {
            toast.error(`Error al registrar compra: ${error.message}`);
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    const registrarPagoProveedor = async (pago) => {
        setIsSaving(true);
        try {
            const { data: nuevoSaldo, error } = await supabase.rpc('sp_registrar_pago_proveedor', {
                p_id_empresa: empresaId,
                p_id_compra: pago.id_compra,
                p_monto_pagado: pago.monto_pagado,
                p_fecha_pago: pago.fecha_pago,
                p_id_cuenta_banco: pago.id_cuenta_banco
            });
            if (error) throw error;

            toast.success(`✅ Pago registrado. Nuevo saldo: C$ ${nuevoSaldo.toFixed(2)}`);
            await fetchCompras(); // Refresca la lista de compras
            return { success: true };
        } catch (error) {
            toast.error(`Error al registrar pago: ${error.message}`);
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    return {
        compras,
        isLoading,
        isSaving,
        registrarCompra,
        registrarPagoProveedor,
        fetchCompras
    };
}