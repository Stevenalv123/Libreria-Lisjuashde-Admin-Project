// /components/RegistrarPagoProveedor.jsx
import { Save } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from "react-hot-toast";
import { useCompras } from '../hooks/useCompras';
import { useCuentas } from '../hooks/useCuentas'; // Para la lista de cuentas de banco/caja

export default function RegistrarPagoProveedor({ onClose, compra }) {
    const { registrarPagoProveedor, isSaving } = useCompras();
    const { catalogoCuentas, isLoading: isLoadingCuentas } = useCuentas();

    // Estados del formulario
    const [montoPagado, setMontoPagado] = useState(compra.saldo_pendiente.toFixed(2));
    const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
    const [idCuentaBanco, setIdCuentaBanco] = useState('');

    // Filtra solo las cuentas de Activo (Caja/Bancos) para PAGAR
    const cuentasDeEfectivo = useMemo(() => {
        if (!catalogoCuentas) return [];
        // Asume que ID 1 = Activo
        return catalogoCuentas.filter(c => c.id_tipo === 1);
    }, [catalogoCuentas]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!idCuentaBanco || !montoPagado || Number(montoPagado) <= 0) {
            toast.error("Seleccione una cuenta de banco y un monto válido.");
            return;
        }
        if (Number(montoPagado) > compra.saldo_pendiente) {
            toast.error("El pago no puede ser mayor al saldo pendiente.");
            return;
        }

        const pago = {
            id_compra: compra.id_compra,
            monto_pagado: Number(montoPagado),
            fecha_pago: fechaPago,
            id_cuenta_banco: Number(idCuentaBanco)
        };

        const { success } = await registrarPagoProveedor(pago);
        if (success) {
            onClose();
        }
    };

    return (
        <div className="bg-primary text-title p-8 rounded-2xl w-full max-w-xl shadow-lg animate-fade-in border-1 border-secondary">
            <h3 className="text-2xl font-semibold mb-6">Registrar Pago a Proveedor</h3>
            <div className='mb-4 border border-secondary/30 rounded-lg p-3 text-sm'>
                <p><strong>Proveedor:</strong> {compra.nombre_proveedor}</p>
                <p><strong>Compra N°:</strong> {compra.id_compra}</p>
                <p><strong>Saldo Pendiente:</strong> <span className='font-bold text-red-400'>C$ {compra.saldo_pendiente.toFixed(2)}</span></p>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Monto a Pagar</label>
                        <input
                            type="number"
                            step="0.01"
                            value={montoPagado}
                            onChange={e => setMontoPagado(e.target.value)}
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Fecha de Pago</label>
                        <input
                            type="date"
                            value={fechaPago}
                            onChange={(e) => setFechaPago(e.target.value)}
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className="md:col-span-2 flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Pagar desde (Caja/Banco)</label>
                        <select
                            value={idCuentaBanco}
                            onChange={(e) => setIdCuentaBanco(e.target.value)}
                            className="bg-input border border-secondary w-full rounded-lg p-3"
                            control required
                        >
                            <option value="">{isLoadingCuentas ? "Cargando..." : "Seleccione cuenta..."}</option>
                            {cuentasDeEfectivo.map(c => (
                                <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex justify-end gap-4 mt-8">
                <button type="button" onClick={onClose} className="cursor-pointer bg-secondary text-button-text border border-secondary font-semibold py-2 px-6 rounded-lg hover:bg-button-cancel transition-transform duration-200 ease-in-out hover:scale-110">Cancelar</button>
                    <button
                        type="submit"
                        disabled={isSaving || isLoadingCuentas}
                        className="cursor-pointer bg-button text-button font-semibold py-2 px-2 rounded-lg hover:bg-[#E8E8E8] transition-transform duration-200 ease-in-out hover:scale-110 flex flex-row gap-2 items-center"
                    >
                        <Save />
                        {isSaving ? "Guardando..." : "Guardar Pago"}
                    </button>
                </div>
            </form >
        </div >
    );
}