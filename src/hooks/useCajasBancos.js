import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

export function useCajasBancos() {
    const { empresaId } = useEmpresa();

    const [movimientos, setMovimientos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const [isSavingMov, setIsSavingMov] = useState(false);
    const [isDeletingMov, setIsDeletingMov] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const fetchMovimientos = useCallback(async () => {
        if (!empresaId) return;

        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('movimiento')
                .select(`
                    id_movimiento,
                    fecha,
                    descripcion,
                    tipo,
                    monto,
                    fecha_registro,
                    comprobante_id,
                    conciliado,
                    cuentas_empresa ( nombre, codigo, es_banco, es_efectivo ),
                    comprobantes ( numero, tipo, estado )
                `)
                .eq('id_empresa', empresaId)
                .order('fecha', { ascending: false })
                .order('fecha_registro', { ascending: false });

            if (error) {
                throw new Error("No se pudieron cargar los movimientos");
            }

            setMovimientos(data || []);
        } catch (error) {
            console.error(error.message);
            setMovimientos([]);
        } finally {
            setIsLoading(false);
        }
    }, [empresaId]);
    useEffect(() => {
        fetchMovimientos();
    }, [fetchMovimientos]);

    // Crea un movimiento de caja/banco como un comprobante MANUAL balanceado.
    // Requiere cuenta principal + cuenta de contrapartida (Debe = Haber en una sola llamada).
    const agregarMovimiento = async (movimiento) => {
        setIsSavingMov(true);
        if (!empresaId) {
            toast.error("Error: No se ha seleccionado una empresa.");
            setIsSavingMov(false);
            return null;
        }

        const { id_cuenta, id_contrapartida, monto, tipo, fecha, descripcion, referencia } = movimiento;

        if (!id_cuenta || !id_contrapartida) {
            toast.error("Seleccione la cuenta y la cuenta de contrapartida.");
            setIsSavingMov(false);
            return null;
        }
        if (Number(id_cuenta) === Number(id_contrapartida)) {
            toast.error("La cuenta y la contrapartida deben ser distintas.");
            setIsSavingMov(false);
            return null;
        }

        const tipoPrincipal = tipo === 'DEBE' ? 'DEBE' : 'HABER';
        const tipoContra = tipoPrincipal === 'DEBE' ? 'HABER' : 'DEBE';
        const desc = descripcion || "Movimiento de caja/banco";

        const p_lineas = [
            { id_cuenta: Number(id_cuenta), tipo: tipoPrincipal, monto: Number(monto), descripcion: desc },
            { id_cuenta: Number(id_contrapartida), tipo: tipoContra, monto: Number(monto), descripcion: desc },
        ];

        try {
            const { data, error } = await supabase.rpc('sp_crear_comprobante_manual', {
                p_fecha: fecha,
                p_descripcion: desc,
                p_lineas: p_lineas,
                p_contabilizar: true,
                p_referencia: referencia || null,
            });

            if (error) throw error;

            await fetchMovimientos();
            setIsSavingMov(false);
            return data;

        } catch (error) {
            console.error("Error al guardar movimiento:", error.message);
            toast.error("Error al guardar: " + error.message);
            setIsSavingMov(false);
            return null;
        }
    };

    // Los comprobantes contabilizados no se borran: se REVIERTEN con un asiento espejo.
    const revertirMovimiento = async (comprobanteId, motivo) => {
        setIsDeletingMov(true);
        try {
            if (!comprobanteId) {
                throw new Error("Este movimiento no tiene comprobante asociado y no puede revertirse.");
            }
            const { error } = await supabase.rpc('sp_revertir_comprobante', {
                p_id: Number(comprobanteId),
                p_motivo: motivo || "Reversión de movimiento de caja/banco",
            });

            if (error) throw error;

            await fetchMovimientos();
            setIsDeletingMov(false);
            return { success: true };

        } catch (error) {
            console.error("Error al revertir movimiento:", error.message);
            setIsDeletingMov(false);
            return { success: false, message: error.message };
        }
    };

    const registrarSaldoInicial = async (datos) => {
        setIsSaving(true);
        try {
            const { error } = await supabase.rpc('sp_registrar_saldo_inicial', {
                p_id_empresa: empresaId,
                p_id_cuenta_destino: Number(datos.id_cuenta),
                p_monto: Number(datos.monto),
                p_fecha: datos.fecha,
                p_descripcion: datos.descripcion || "Saldo Inicial de Apertura"
            });

            if (error) throw error;

            toast.success("✅ Saldo inicial registrado correctamente.");
            await fetchMovimientos(); // Refrescar la tabla
            return { success: true };
        } catch (error) {
            console.error(error);
            toast.error("Error: " + error.message);
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    return {
        movimientos,
        isLoading,
        agregarMovimiento,
        isSavingMov,
        revertirMovimiento,
        isDeletingMov,
        registrarSaldoInicial,
        isSaving,
        fetchMovimientos
    };
}
