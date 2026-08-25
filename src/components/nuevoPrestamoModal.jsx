// /components/NuevoPrestamoModal.jsx
import { Save } from 'lucide-react';
import { useState, useMemo } from 'react';
import { toast } from "react-hot-toast";
import { usePrestamos } from '../hooks/usePrestamos';
import { useCuentas } from '../hooks/useCuentas';

export default function NuevoPrestamoModal({ onClose }) {
    // 1. Hooks de datos
    const { registrarPrestamo, isSavingPrestamos } = usePrestamos();
    const { catalogoCuentas: cuentas, isLoading: isLoadingCuentas } = useCuentas();

    // 2. Estados del formulario
    const [descripcion, setDescripcion] = useState('');
    const [montoPrincipal, setMontoPrincipal] = useState('');
    const [tasaAnual, setTasaAnual] = useState('');
    const [plazoMeses, setPlazoMeses] = useState('');
    const [fechaDesembolso, setFechaDesembolso] = useState(new Date().toISOString().slice(0, 10));
    const [idCuentaBanco, setIdCuentaBanco] = useState('');
    const [idCuentaPasivo, setIdCuentaPasivo] = useState('');
    const [idCuentaGasto, setIdCuentaGasto] = useState('');

    // 3. Filtrar cuentas para los <select>
    const { cuentasActivo, cuentasPasivo, cuentasGasto } = useMemo(() => {
        if (!cuentas) return { cuentasActivo: [], cuentasPasivo: [], cuentasGasto: [] };
        // Asumiendo IDs de tipo: 1=Activo, 2=Pasivo, 5=Gasto
        return {
            cuentasActivo: cuentas.filter(c => c.id_tipo === 1),
            cuentasPasivo: cuentas.filter(c => c.id_tipo === 2),
            cuentasGasto: cuentas.filter(c => c.id_tipo === 5)
        };
    }, [cuentas]);

    // 4. Handler para guardar
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!descripcion || !montoPrincipal || !tasaAnual || !plazoMeses || !fechaDesembolso || !idCuentaBanco || !idCuentaPasivo || !idCuentaGasto) {
            toast.error("Por favor, complete todos los campos.");
            return;
        }

        const nuevoPrestamo = {
            descripcion,
            monto_principal: Number(montoPrincipal),
            tasa_interes_anual: Number(tasaAnual),
            plazo_meses: Number(plazoMeses),
            fecha_desembolso: fechaDesembolso,
            id_cuenta_banco: Number(idCuentaBanco),
            id_cuenta_pasivo: Number(idCuentaPasivo),
            id_cuenta_gasto: Number(idCuentaGasto)
        };

        const { success } = await registrarPrestamo(nuevoPrestamo);

        if (success) {
            onClose(); // Cierra el modal
        }
    };

    return (
        <div className="bg-primary text-title p-8 rounded-2xl w-full max-w-4xl shadow-lg animate-fade-in border-1 border-secondary">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-semibold">Registrar Nuevo Préstamo</h3>
            </div>
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">

                    <div className="md:col-span-3 flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Descripción</label>
                        <input
                            type="text"
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            placeholder="Ej. Préstamo BAC Vehículo"
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Monto Principal</label>
                        <input
                            type="number"
                            step="0.01"
                            value={montoPrincipal}
                            onChange={e => setMontoPrincipal(e.target.value)}
                            placeholder="C$ 0.00"
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Tasa de Interés Anual (%)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={tasaAnual}
                            onChange={e => setTasaAnual(e.target.value)}
                            placeholder="Ej. 18.5"
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Plazo (en meses)</label>
                        <input
                            type="number"
                            step="1"
                            value={plazoMeses}
                            onChange={e => setPlazoMeses(e.target.value)}
                            placeholder="Ej. 36"
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Fecha Desembolso</label>
                        <input
                            type="date"
                            value={fechaDesembolso}
                            onChange={(e) => setFechaDesembolso(e.target.value)}
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Cuenta de Banco (Recibe)</label>
                        <select
                            value={idCuentaBanco}
                            onChange={(e) => setIdCuentaBanco(e.target.value)}
                            className="bg-input border border-secondary w-full rounded-lg p-3"
                            required
                        >
                            <option value="">{isLoadingCuentas ? "Cargando..." : "Seleccione cuenta de banco..."}</option>
                            {cuentasActivo.map(c => (
                                <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Cuenta de Pasivo (Deuda)</label>
                        <select
                            value={idCuentaPasivo}
                            onChange={(e) => setIdCuentaPasivo(e.target.value)}
                            className="bg-input border border-secondary w-full rounded-lg p-3"
                            required
                        >
                            <option value="">{isLoadingCuentas ? "Cargando..." : "Seleccione cuenta de pasivo..."}</option>
                            {cuentasPasivo.map(c => (
                                <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium text-title">Cuenta de Gasto (Interés)</label>
                        <select
                            value={idCuentaGasto}
                            onChange={(e) => setIdCuentaGasto(e.target.value)}
                            className="bg-input border border-secondary w-full rounded-lg p-3"
                            required
                        >
                            <option value="">{isLoadingCuentas ? "Cargando..." : "Seleccione cuenta de gasto..."}</option>
                            {cuentasGasto.map(c => (
                                <option key={c.id_cuenta} value={c.id_cuenta}>{c.nombre}</option>
                            ))}
                        </select>
                    </div>

                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <button type="button" onClick={onClose} className="cursor-pointer bg-secondary text-button-text border border-secondary font-semibold py-2 px-6 rounded-lg hover:bg-button-cancel transition-transform duration-200 ease-in-out hover:scale-110">Cancelar</button>
                    <button
                        type="submit"
                        disabled={isSavingPrestamos || isLoadingCuentas}
                        className="cursor-pointer bg-button text-button font-semibold py-2 px-2 rounded-lg hover:bg-[#E8E8E8] transition-transform duration-200 ease-in-out hover:scale-110 flex flex-row gap-2 items-center disabled:opacity-70"
                    >
                        <Save />
                        {isSavingPrestamos ? "Guardando..." : "Guardar Préstamo"}
                    </button>
                </div>
            </form>
        </div>
    );
}