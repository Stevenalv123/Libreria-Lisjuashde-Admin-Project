import { useState, useEffect, useCallback } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

export function usePrestamos() {
    const { empresaId } = useEmpresa();
    const [prestamos, setPrestamos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false); // <-- NUEVO ESTADO

    const fetchPrestamos = useCallback(async () => {
        if (!empresaId) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('prestamos')
                .select('*')
                .eq('id_empresa', empresaId)
                .order('fecha_desembolso', { ascending: false });

            if (error) throw error;
            setPrestamos(data || []);
        } catch (error) {
            toast.error(`Error al cargar préstamos: ${error.message}`);
            setPrestamos([]);
        } finally {
            setIsLoading(false);
        }
    }, [empresaId]);

    useEffect(() => {
        fetchPrestamos();
    }, [fetchPrestamos]);

    const registrarPrestamo = async (nuevoPrestamo) => {
        setIsSaving(true);
        try {
            const { data, error } = await supabase.rpc('sp_registrar_prestamo', {
                p_id_empresa: empresaId,
                p_descripcion: nuevoPrestamo.descripcion,
                p_monto_principal: nuevoPrestamo.monto_principal,
                p_tasa_interes_anual: nuevoPrestamo.tasa_interes_anual,
                p_plazo_meses: nuevoPrestamo.plazo_meses,
                p_fecha_desembolso: nuevoPrestamo.fecha_desembolso,
                p_id_cuenta_banco: nuevoPrestamo.id_cuenta_banco,
                p_id_cuenta_pasivo: nuevoPrestamo.id_cuenta_pasivo,
                p_id_cuenta_gasto: nuevoPrestamo.id_cuenta_gasto
            });

            if (error) throw error;

            toast.success(`✅ Préstamo "${nuevoPrestamo.descripcion}" registrado correctamente.`);
            await fetchPrestamos();
            return { success: true };

        } catch (error) {
            toast.error(`Error al registrar préstamo: ${error.message}`);
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    const pagarCuota = async (idPrestamo, fechaPago) => {
        setIsSaving(true);
        try {
            const { data: nuevoSaldo, error } = await supabase.rpc('sp_registrar_pago_cuota_prestamo', {
                p_id_prestamo: idPrestamo,
                p_fecha_pago: fechaPago
            });
            // La 'L' que tenías aquí causaba un error, la eliminé.
            if (error) throw error;

            toast.success(`✅ Pago registrado. Nuevo saldo: C$ ${nuevoSaldo.toFixed(2)}`);
            await fetchPrestamos();
            return { success: true };

        } catch (error) {
            toast.error(`Error al pagar cuota: ${error.message}`);
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    };

    // --- NUEVA FUNCIÓN ---
    const eliminarPrestamo = async (id_prestamo) => {
        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('prestamos')
                .delete()
                .eq('id_prestamo', id_prestamo);

            if (error) throw error;

            toast.success('Préstamo eliminado de la lista.');
            await fetchPrestamos();

            return { success: true };

        } catch (error) {
            console.error("Error al eliminar préstamo:", error.message);
            toast.error(`Error al eliminar: ${error.message}`);
            return { success: false, message: error.message };
        } finally {
            setIsDeleting(false);
        }
    };

    return {
        prestamos,
        isLoading,
        isSaving,
        isDeleting,
        registrarPrestamo,
        pagarCuota,
        fetchPrestamos,
        eliminarPrestamo // <-- NUEVA FUNCIÓN EXPORTADA
    };
}