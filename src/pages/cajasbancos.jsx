import StatsCards from "../components/statscards";
import Tabs from "../components/tabs";
import NuevoMovCajas from "../components/nuevomovcajas";
import { useState, useEffect, useMemo } from "react";
import { TrendingUp, TrendingDown, Plus, Pencil, Trash, DollarSign, Banknote, Wallet, CreditCard } from "lucide-react";
import { useCajasBancos } from "../hooks/useCajasBancos";
import Swal from "sweetalert2";
import { toast } from "react-hot-toast";
import { format } from "date-fns/format"
import { usePrestamos } from "../hooks/usePrestamos";
import NuevoPrestamoModal from "../components/nuevoPrestamoModal";
import ModalSaldoInicial from "../components/modalSaldoInicial";
import {supabase} from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

export default function CajasBancos() {
    const tabs = [
        { key: "movimientos", label: "Movimientos", icon: <DollarSign size={16} /> },
        { key: "cuentasBancarias", label: "Cuentas Bancarias", icon: <Banknote size={16} /> }
    ];
    const { empresaId } = useEmpresa();
    const [activeTab, setActiveTab] = useState("movimientos");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPrestamoModalOpen, setIsPrestamoModalOpen] = useState(false);
    const [isSaldoInicialOpen, setIsSaldoInicialOpen] = useState(false);
    const {
        prestamos,
        isLoading: isLoadingPrestamos,
        isSaving: isSavingPrestamo,
        isDeleting: isDeletingPrestamo,
        pagarCuota,
        eliminarPrestamo
    } = usePrestamos();

    const {
        movimientos,
        isLoading,
        eliminarMovimiento,
        isDeletingMov
    } = useCajasBancos();

    const [saldos, setSaldos] = useState({ caja: 0, banco: 0 });

    // --- 2. EFECTO PARA CARGAR SALDOS REALES ---
    useEffect(() => {
        const fetchSaldos = async () => {
            if (!empresaId) return;
            const today = new Date().toISOString().split('T')[0];

            try {
                // Reusamos la función de balance para obtener el saldo al día de hoy
                const { data, error } = await supabase.rpc('sp_get_balance_as_of_date', {
                    p_id_empresa: empresaId,
                    p_fecha_corte: today
                });

                if (error) throw error;

                if (data) {
                    // Filtramos por nombre para encontrar Caja y Banco
                    const saldoCaja = data.find(c => c.cuenta.toLowerCase().includes('caja'))?.saldo || 0;
                    // Sumamos todas las cuentas que parezcan bancos
                    const saldoBanco = data
                        .filter(c => c.cuenta.toLowerCase().includes('banco'))
                        .reduce((sum, c) => sum + c.saldo, 0);

                    setSaldos({ caja: saldoCaja, banco: saldoBanco });
                }
            } catch (err) {
                console.error("Error al cargar saldos:", err);
            }
        };

        fetchSaldos();
    }, [empresaId, movimientos]);

    const { totalIngresos, totalEgresos } = useMemo(() => {
        return movimientos.reduce((acc, mov) => {
            const esEfectivo = ['Caja', 'Banco', 'Bancos', 'Caja General'].some(nombre => 
                mov.cuentas_empresa?.nombre?.includes(nombre)
            );

            // Solo sumamos si el movimiento afectó a una cuenta de efectivo
            if (esEfectivo) {
                if (mov.tipo === 'DEBE') {
                    acc.totalIngresos += mov.monto;
                } else {
                    acc.totalEgresos += mov.monto;
                }
            }
            return acc;
        }, { totalIngresos: 0, totalEgresos: 0 });
    }, [movimientos]);

    const formatMoney = (amount) => `C$ ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const handleEliminarMovimiento = async (id, descripcion) => {
        const descText = descripcion || "este movimiento";

        Swal.fire({
            title: '¿Estás seguro?',
            text: `Esta acción no se puede revertir. Se eliminará ${descText}.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#262626',
            confirmButtonText: 'Sí, ¡eliminar!',
            cancelButtonText: 'Cancelar',
            background: '#090909',
            color: '#fff',
            customClass: {
                popup: 'border border-secondary rounded-2xl'
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { success, message } = await eliminarMovimiento(id);

                if (success) {
                    toast.success('✅ Movimiento eliminado correctamente');
                } else {
                    toast.error(`⚠️ Error al eliminar: ${message}`);
                }
            }
        });
    };

    const handlePagarCuota = async (idPrestamo, montoCuota) => {
        Swal.fire({
            title: '¿Confirmar Pago?',
            text: `Se registrará un pago de C$ ${montoCuota.toFixed(2)}. Esta acción creará un asiento contable.`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#10b981', // Verde
            cancelButtonColor: '#262626',
            confirmButtonText: 'Sí, ¡pagar cuota!',
            cancelButtonText: 'Cancelar',
            background: '#090909',
            color: '#fff',
            customClass: {
                popup: 'border border-secondary rounded-2xl'
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const fechaHoy = format(new Date(), 'yyyy-MM-dd');
                await pagarCuota(idPrestamo, fechaHoy);
            }
        });
    };

    // --- NUEVA FUNCIÓN PARA ELIMINAR PRÉSTAMO ---
    const handleEliminarPrestamo = async (id, descripcion) => {
        const descText = descripcion || "este préstamo";

        Swal.fire({
            title: '¿Estás seguro?',
            // Advertencia importante
            text: `Se eliminará ${descText}. NOTA: Esta acción NO reversará los asientos contables ya registrados.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            // ... (resto de tu config de Swal)
            confirmButtonText: 'Sí, ¡eliminar!',
            background: '#090909',
            color: '#fff',
        }).then(async (result) => {
            if (result.isConfirmed) {
                const { success, message } = await eliminarPrestamo(id);
                if (!success) {
                    toast.error(`⚠️ Error al eliminar: ${message}`);
                }
            }
        });
    };

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <StatsCards title={"Saldo en Caja"} icon={<Wallet className="text-title" />} value={formatMoney(saldos.caja)} />
                <StatsCards title={"Saldo en Bancos"} icon={<DollarSign className="text-title" />} value={formatMoney(saldos.banco)} />
                <StatsCards title={"Ingresos"} icon={<TrendingUp color="green" />} value={formatMoney(totalIngresos)} />
                <StatsCards title={"Egresos"} icon={<TrendingDown color="red" className="text-title" />} value={formatMoney(totalEgresos)} />
            </div>

            <div className="mt-6">
                <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
                <div className="mt-8 border border-secondary rounded-2xl p-5">
                    {activeTab === "movimientos" && (
                        <>
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-title text-xl font-bold">Movimientos</h3>
                                    <p className="text-subtitle text-s">Registra ingresos y egresos</p>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4">
                                    <button
                                        onClick={() => setIsSaldoInicialOpen(true)}
                                        className="text-yellow-500 hover:text-yellow-400 text-sm flex items-center gap-2 border border-yellow-500/30 px-3 py-1 rounded-lg"
                                    >
                                        + Registrar Saldo Inicial (Capital)
                                    </button>
                                    <button className="btn-new bg-button text-button flex flex-row h-10 text-s gap-3 p-2 rounded-xl items-center cursor-pointer hover:opacity-95 hover:scale-110 transition" onClick={() => setIsModalOpen(true)}>
                                        <span className="icon"><Plus /></span> Nuevo Movimiento
                                    </button>
                                </div>

                            </div>

                            <div className="mt-8 overflow-x-auto">
                                {isLoading ? (
                                    <p className="p-4 text-center text-gray-400">Cargando movimientos...</p>
                                ) : movimientos.length === 0 ? (
                                    <p className="p-4 text-center text-gray-400">No hay movimientos registrados. ¡Agrega uno nuevo!</p>
                                ) : (
                                    <div className="inline-block min-w-full align-middle">
                                        <div className="overflow-hidden rounded-lg mb-8">
                                            <table className="min-w-full text-title">
                                                <thead className="bg-secondary/10">
                                                    <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                                                        <th className="py-3 px-4 text-center">Fecha</th>
                                                        <th className="py-3 px-4 text-center">Cuenta</th>
                                                        <th className="py-3 px-4 text-center">Descripción</th>
                                                        <th className="py-3 px-4 text-center">Tipo</th>
                                                        <th className="py-3 px-4 text-center">Monto</th>
                                                        <th className="py-3 px-4 text-center">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {movimientos.map((m) => (
                                                        <tr key={m.id_movimiento} className="border-t border-secondary text-sm hover:bg-secondary/10 transition-colors">
                                                            <td className="py-4 px-4 font-medium text-title text-center">{format(new Date(m.fecha), 'dd/MM/yyyy')}</td>
                                                            <td className="py-4 px-4 text-title text-center">{m.cuentas_empresa?.nombre || "N/A"}</td>
                                                            <td className="py-4 px-4 text-title text-center">{m.descripcion || "-"}</td>
                                                            <td className="py-4 px-4 text-center">
                                                                <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${m.tipo === 'DEBE'
                                                                    ? 'bg-green-600/20 text-white-400'
                                                                    : 'bg-red-600/20 text-white-400'
                                                                    }`}>
                                                                    {m.tipo}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-4 font-mono text-title text-center">C${parseFloat(m.monto).toFixed(2)}</td>
                                                            <td className="py-4 px-4">
                                                                <div className="flex justify-center gap-8">
                                                                    <button title="Editar Movimiento" className="text-blue-400 hover:text-blue-300 transition-colors transform hover:scale-110 cursor-pointer">
                                                                        <Pencil size={18} />
                                                                    </button>
                                                                    <button
                                                                        title="Eliminar Movimiento"
                                                                        className="text-red-500 hover:text-red-400 transition-colors transform hover:scale-110 cursor-pointer"
                                                                        onClick={() => handleEliminarMovimiento(m.id_movimiento, m.descripcion)}
                                                                        disabled={isDeletingMov}
                                                                    >
                                                                        <Trash size={18} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {activeTab === "cuentasBancarias" && (
                        <>
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-title text-xl font-bold">Movimientos de Bancos</h3>
                                    <p className="text-subtitle text-s">Registra los prestamos y pagos de cuotas</p>
                                </div>
                                <button className="btn-new bg-button text-button flex flex-row h-10 text-s gap-3 p-2 rounded-xl items-center cursor-pointer hover:opacity-95 hover:scale-110 transition" onClick={() => setIsPrestamoModalOpen(true)}>
                                    <span className="icon"><Plus /></span> Registrar Prestamo
                                </button>
                            </div>

                            <div className="mt-8 overflow-x-auto">
                                {isLoadingPrestamos ? (
                                    <p className="p-4 text-center text-gray-400">Cargando prestamos...</p>
                                ) : prestamos.length === 0 ? (
                                    <p className="p-4 text-center text-gray-400">No hay prestamos registrados. ¡Agrega uno nuevo!</p>
                                ) : (
                                    <div className="inline-block min-w-full align-middle">
                                        <div className="overflow-hidden rounded-lg mb-8">
                                            <table className="min-w-full text-title">
                                                <thead className="bg-secondary/10">
                                                    <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                                                        <th className="py-3 px-4 text-center">Fecha de Desembolso</th>
                                                        <th className="py-3 px-4 text-center">Descripcion</th>
                                                        <th className="py-3 px-4 text-center">Monto Principal</th>
                                                        <th className="py-3 px-4 text-center">Saldo Actual</th>
                                                        <th className="py-3 px-4 text-center">Tasa interes Anual</th>
                                                        <th className="py-3 px-4 text-center">Plazo en Meses</th>
                                                        <th className="py-3 px-4 text-center">Cuota Mensual</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {prestamos.map((m) => (
                                                        <tr key={m.id_prestamo} className="border-t border-secondary text-sm hover:bg-secondary/10 transition-colors">
                                                            <td className="py-4 px-4 font-medium text-title text-center">{format(new Date(m.fecha_desembolso), 'dd/MM/yyyy')}</td>
                                                            <td className="py-4 px-4 text-title text-center">{m.descripcion}</td>
                                                            <td className="py-4 px-4 text-title text-center">C${parseFloat(m.monto_principal).toFixed(2)}</td>
                                                            <td className="py-4 px-4 text-title text-center">C${parseFloat(m.saldo_actual).toFixed(2)}</td>
                                                            <td className="py-4 px-4 text-center">{m.tasa_interes_anual}%</td>
                                                            <td className="py-4 px-4 text-center">{m.plazo_meses}</td>
                                                            <td className="py-4 px-4 text-center">C${parseFloat(m.monto_cuota_mensual).toFixed(2)}</td>
                                                            <td className="py-4 px-4">
                                                                <div className="flex justify-center gap-4">
                                                                    <button
                                                                        title="Pagar Cuota"
                                                                        className="hover:text-green-400 disabled:opacity-50 transition-colors transform hover:scale-110 cursor-pointer flex flex-row gap-3 border border-secondary rounded-lg px-3 py-1 items-center"
                                                                        onClick={() => handlePagarCuota(m.id_prestamo, m.monto_cuota_mensual)}
                                                                        disabled={isSavingPrestamo || m.estado === 'Pagado'}
                                                                    >
                                                                        <CreditCard size={18} />
                                                                        Pagar Cuota
                                                                    </button>
                                                                    <button
                                                                        title="Editar Préstamo (No implementado)"
                                                                        className="text-blue-400 hover:text-blue-300 transition-colors transform hover:scale-110 cursor-pointer disabled:opacity-30"
                                                                        onClick={() => toast.info('La edición de préstamos no está implementada.')}
                                                                        disabled={true}
                                                                    >
                                                                        <Pencil size={18} />
                                                                    </button>
                                                                    <button
                                                                        title="Eliminar Préstamo"
                                                                        className="text-red-500 hover:text-red-400 transition-colors transform hover:scale-110 cursor-pointer"
                                                                        onClick={() => handleEliminarPrestamo(m.id_prestamo, m.descripcion)}
                                                                        disabled={isDeletingPrestamo}
                                                                    >
                                                                        <Trash size={18} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative z-10 mx-4">
                        <NuevoMovCajas
                            onClose={() => setIsModalOpen(false)}
                            onMovimientoAgregado={() => setIsModalOpen(false)}
                        />
                    </div>
                </div>
            )}

            {isPrestamoModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => setIsPrestamoModalOpen(false)}></div>
                    <div className="relative z-10 mx-4">
                        <NuevoPrestamoModal
                            onClose={() => setIsPrestamoModalOpen(false)}
                            onPrestamoAgregado={() => setIsPrestamoModalOpen(false)}
                        />
                    </div>
                </div>
            )}

            {isSaldoInicialOpen && (
                <ModalSaldoInicial onClose={() => setIsSaldoInicialOpen(false)} />
            )}
        </div>
    );
}
