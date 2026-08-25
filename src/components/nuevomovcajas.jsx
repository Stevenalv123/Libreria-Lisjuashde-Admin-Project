import { Plus, Save } from 'lucide-react';
import NuevaCuenta from "./nuevaCuenta";
import { useEffect, useState } from 'react';
import { toast } from "react-hot-toast";
import { useCajasBancos } from "../hooks/useCajasBancos";
import { useCuentas } from '../hooks/useCuentas';

export default function NuevomovCaja({ onClose }) {
    const { agregarMovimiento, isLoading: isSavingMov } = useCajasBancos();
    const { 
        catalogoCuentas: cuentas,        
        tipos,          
        subtipos,       
        crearCuenta,    
        isLoading: isLoadingCuentas 
    } = useCuentas();

    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [id_cuenta, setIdCuenta] = useState("");
    const [monto, setMonto] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [tipoMovimiento, setTipoMovimiento] = useState("DEBE"); 
    const [referencia, setReferencia] = useState("");
    
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!id_cuenta || !monto || !tipoMovimiento) {
            toast.error("Complete la cuenta, monto y tipo de movimiento.");
            return;
        }

        const movimiento = {
            id_cuenta: Number(id_cuenta),
            monto: Number(monto),
            tipo: tipoMovimiento, 
            fecha: fecha,
            descripcion: descripcion || null,
            referencia: referencia || null 
        };
        
        const result = await agregarMovimiento(movimiento);

        if (result) {
            toast.success("✅ Movimiento guardado correctamente");
            onClose();
        } else {
            toast.error("⚠️ Error al guardar el movimiento");
        }
    };

    return (
        <>
            <div className="bg-primary text-title p-8 rounded-2xl w-full max-w-4xl shadow-lg animate-fade-in border-1 border-secondary">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-semibold">Nuevo Movimiento</h3>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="fecha" className="text-sm font-medium text-title">Fecha</label>
                            <input
                                id="fecha"
                                type="date"
                                value={fecha}
                                onChange={(e) => setFecha(e.target.value)}
                                className="bg-input border border-secondary rounded-lg p-3"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Cuenta</label>
                            <div className='flex flex-row gap-2 justify-between items-center'>
                                <select 
                                    value={id_cuenta} 
                                    onChange={(e) => setIdCuenta(e.target.value)} 
                                    className="bg-input border border-secondary w-full rounded-lg p-3 appearance-none"
                                    required
                                >
                                    <option value="">{isLoadingCuentas ? "Cargando..." : "Seleccione cuenta"}</option>
                                    {cuentas.map(c => (
                                        <option key={c.id_cuenta} value={c.id_cuenta}>
                                          {c.nombre}
                                        </option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setIsModalOpen(true)} className="btn-new bg-button text-button p-3 rounded-lg flex justify-center items-center hover:opacity-95 transition-transform duration-200 ease-in-out hover:scale-110 cursor-pointer">
                                    <Plus />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Tipo de Movimiento</label>
                            <select 
                                value={tipoMovimiento} 
                                onChange={(e) => setTipoMovimiento(e.target.value)} 
                                className="bg-input border border-secondary rounded-lg p-3"
                                required
                            >
                                <option value="DEBE">Ingreso (Debe)</option>
                                <option value="HABER">Gasto (Haber)</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Monto</label>
                            <input 
                                type="number" 
                                step="0.01"
                                value={monto}
                                onChange={e => setMonto(e.target.value)} 
                                placeholder="C$ 0.00" 
                                className="bg-input border border-secondary rounded-lg p-3" 
                                required
                            />
                        </div>

                        <div className="md:col-span-2 flex flex-col gap-2">
                            <label htmlFor="referencia" className="text-sm font-medium text-title">Referencia (Opcional)</label>
                            <input 
                                id="referencia" 
                                type="text" 
                                value={referencia}
                                onChange={(e) => setReferencia(e.target.value)}
                                placeholder="N° cheque, N° transferencia, N° factura, etc." 
                                className="bg-input border border-secondary rounded-lg p-3" 
                            />
                        </div>

                        <div className="md:col-span-3 flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Descripción (Opcional)</label>
                            <input 
                                type="text" 
                                value={descripcion}
                                onChange={e => setDescripcion(e.target.value)} 
                                placeholder="Descripción del movimiento" 
                                className="bg-input border border-secondary rounded-lg p-3" 
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-8">
                        <button type="button" onClick={onClose} className="cursor-pointer bg-secondary text-button-text border border-secondary font-semibold py-2 px-6 rounded-lg hover:bg-button-cancel transition-transform duration-200 ease-in-out hover:scale-110">Cancelar</button>
                        <button 
                            type="submit" 
                            disabled={isSavingMov || isLoadingCuentas}
                            className="cursor-pointer bg-button text-button font-semibold py-2 px-2 rounded-lg hover:bg-[#E8E8E8] transition-transform duration-200 ease-in-out hover:scale-110 flex flex-row gap-2 items-center disabled:opacity-70"
                        >
                            <Save />
                            {isSavingMov ? "Guardando..." : "Guardar Movimiento"}
                        </button>
                    </div>
                </form>
            </div>

            <NuevaCuenta 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
                tipos={tipos}
                subtipos={subtipos}
                crearCuenta={crearCuenta}
                isLoading={isLoadingCuentas}
            />
        </>
    );
}