import { DollarSign, Pencil, Trash, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

const ROLES_PAGO = ["superadmin", "admin", "gerente"];

export default function EmpleadosCards({
    id_empleado,
    nombre_completo,
    identificacion,
    email,
    telefono,
    salario_mensual,
    estado,
    rol,
}) {
    const { empresaId } = useEmpresa();
    const puedePagar = ROLES_PAGO.includes(rol);

    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [monto, setMonto] = useState(salario_mensual || 0);
    const [metodo, setMetodo] = useState("Efectivo");
    const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
    const [concepto, setConcepto] = useState("Pago de salario");

    const abrirModal = () => {
        setMonto(salario_mensual || 0);
        setMetodo("Efectivo");
        setFecha(new Date().toISOString().slice(0, 10));
        setConcepto("Pago de salario");
        setModalAbierto(true);
    };

    const registrarPago = async (e) => {
        e.preventDefault();

        const montoNum = parseFloat(monto);
        if (!montoNum || montoNum <= 0) {
            toast.error("⚠️ El monto debe ser mayor a cero.");
            return;
        }

        setGuardando(true);
        try {
            const { error } = await supabase.from("pagos_salarios").insert({
                id_empresa: empresaId,
                id_empleado: id_empleado,
                monto: montoNum,
                metodo: metodo,
                fecha_pago: fecha,
                concepto: concepto?.trim() || "Pago de salario",
            });

            if (error) throw error;

            toast.success(`✅ Pago registrado para ${nombre_completo}`);
            setModalAbierto(false);
        } catch (err) {
            console.error("Error al registrar pago:", err.message);
            toast.error(`⚠️ ${err.message || "Error al registrar el pago"}`);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <div className="flex flex-col md:flex-row border border-secondary rounded-lg p-4 justify-between md:items-center shadow-sm hover:shadow-md transition-shadow duration-200">
                <div className="flex flex-col">
                    <div className="flex flex-row gap-2 items-center mb-2 flex-wrap">
                        <h4 className="font-semibold text-title text-lg">{nombre_completo}</h4>
                        <div>
                            <span className={`text-xs rounded-[20px] py-1 px-3 ${estado === 'Activo'
                                ? 'bg-button text-button'
                                : 'bg-red-600/20 text-red-400'
                                }`}>
                                {estado || 'Activo'}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center md:gap-2 text-sm text-subtitle mb-1">
                        <span>{identificacion}</span>
                        <span className="hidden md:inline">|</span>
                        <span>{email}</span>
                        <span className="hidden md:inline">|</span>
                        <span>{telefono}</span>
                    </div>
                    <p><span className="text-subtitle">Salario: </span>C$ {(salario_mensual || 0).toFixed(2)}</p>
                </div>
                <div className="flex flex-row flex-wrap gap-3 items-center mt-4 md:mt-0">
                    <button className="border border-secondary text-title p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition">Dar de baja</button>
                    {puedePagar && (
                        <button
                            onClick={abrirModal}
                            className="border border-secondary text-green-500 p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition flex items-center gap-1"
                        >
                            <DollarSign size={14} /> Pagar Salario
                        </button>
                    )}
                    <button className="border border-secondary text-title p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition"><Pencil size={14} /></button>
                    <button className="border border-secondary text-title p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition"><Trash size={14} /></button>
                </div>
            </div>

            {modalAbierto && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => setModalAbierto(false)}></div>
                    <div className="relative z-10 mx-4 bg-primary text-title p-8 rounded-2xl w-full max-w-md shadow-lg animate-fade-in border-1 border-secondary">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-semibold">Pagar Salario</h3>
                        </div>

                        <form onSubmit={registrarPago} className="flex flex-col gap-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-title">Empleado</label>
                                <input
                                    type="text"
                                    value={nombre_completo}
                                    readOnly
                                    className="bg-input border border-secondary rounded-lg p-3 opacity-80"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-title">Monto (C$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={monto}
                                    onChange={(e) => setMonto(e.target.value)}
                                    required
                                    className="bg-input border border-secondary rounded-lg p-3"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-title">Método de Pago</label>
                                <select
                                    value={metodo}
                                    onChange={(e) => setMetodo(e.target.value)}
                                    className="bg-input border border-secondary rounded-lg p-3"
                                >
                                    <option value="Efectivo">Efectivo</option>
                                    <option value="Transferencia">Transferencia</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-title">Fecha del Pago</label>
                                <input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    className="bg-input border border-secondary rounded-lg p-3 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-title">Concepto</label>
                                <input
                                    type="text"
                                    value={concepto}
                                    onChange={(e) => setConcepto(e.target.value)}
                                    className="bg-input border border-secondary rounded-lg p-3"
                                />
                            </div>

                            <div className="flex justify-end gap-4 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalAbierto(false)}
                                    className="bg-secondary text-button-text cursor-pointer border border-secondary py-2 px-6 rounded-lg hover:bg-secondary transition-transform hover:scale-110"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="bg-button text-button py-2 cursor-pointer px-4 rounded-lg hover:bg-[#E8E8E8] transition-transform hover:scale-110 flex items-center gap-2 disabled:opacity-60"
                                >
                                    <Save size={18} />
                                    {guardando ? "Registrando..." : "Registrar Pago"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
