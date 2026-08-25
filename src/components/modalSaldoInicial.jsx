// /components/ModalSaldoInicial.jsx
import { useState, useEffect } from "react";
import { Save, X } from "lucide-react";
import { useCajasBancos } from "../hooks/useCajasBancos";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

export default function ModalSaldoInicial({ onClose }) {
    const { registrarSaldoInicial, isSaving } = useCajasBancos();
    const { empresaId } = useEmpresa();
    
    const [cuentasEfectivo, setCuentasEfectivo] = useState([]);
    const [monto, setMonto] = useState("");
    const [idCuenta, setIdCuenta] = useState("");
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

    // Cargar solo cuentas de Caja y Banco
    useEffect(() => {
        const cargarCuentas = async () => {
            try {
                // 1. Primero obtenemos el ID del tipo 'Activo' para estar seguros
                const { data: tipoData, error: tipoError } = await supabase
                    .from('tipo_cuenta')
                    .select('id_tipo')
                    .eq('nombre', 'Activo')
                    .single();
                
                if (tipoError) throw tipoError;
                const idActivo = tipoData.id_tipo;

                // 2. Ahora buscamos las cuentas usando ese ID
                const { data, error } = await supabase
                    .from('cuentas_empresa')
                    .select('*')
                    .eq('id_empresa', empresaId)
                    .eq('id_tipo', idActivo) // <-- Usamos el ID correcto
                    .or('nombre.ilike.%caja%,nombre.ilike.%banco%') 
                    .order('nombre');
                
                if (error) throw error;
                
                setCuentasEfectivo(data || []);

            } catch (err) {
                console.error("Error cargando cuentas:", err.message);
                toast.error("No se pudieron cargar las cuentas de efectivo.");
            }
        };
        if (empresaId) cargarCuentas();
    }, [empresaId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!idCuenta || !monto) return;

        const success = await registrarSaldoInicial({
            id_cuenta: idCuenta,
            monto: monto,
            fecha: fecha,
            descripcion: "Asiento de Apertura (Saldo Inicial)"
        });

        if (success) onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-primary border border-secondary rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-title">Registrar Saldo Inicial</h3>
                    <button onClick={onClose}><X className="text-subtitle" /></button>
                </div>
                
                <p className="text-subtitle text-sm mb-6">
                    Usa esto si la empresa ya tiene dinero antes de usar el sistema. Se registrará como Capital Social.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div>
                        <label className="text-sm text-title">¿Dónde está el dinero?</label>
                        <select 
                            className="bg-input border border-secondary w-full p-3 rounded-lg mt-1"
                            value={idCuenta}
                            onChange={e => setIdCuenta(e.target.value)}
                            required
                        >
                            <option value="">Seleccione Caja o Banco...</option>
                            {cuentasEfectivo.map(c => (
                                <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm text-title">Monto Actual</label>
                        <input 
                            type="number" 
                            step="0.01"
                            className="bg-input border border-secondary w-full p-3 rounded-lg mt-1"
                            value={monto}
                            onChange={e => setMonto(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="text-sm text-title">Fecha de Corte</label>
                        <input 
                            type="date" 
                            className="bg-input border border-secondary w-full p-3 rounded-lg mt-1"
                            value={fecha}
                            onChange={e => setFecha(e.target.value)}
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-subtitle">Cancelar</button>
                        <button 
                            type="submit" 
                            disabled={isSaving}
                            className="bg-button text-button px-4 py-2 rounded-lg flex items-center gap-2 font-semibold"
                        >
                            <Save size={18} /> Guardar Saldo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}