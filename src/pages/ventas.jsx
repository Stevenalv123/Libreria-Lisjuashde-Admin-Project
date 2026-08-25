import StatsCards from "../components/statscards";
import NuevaVenta from "../components/nuevaVenta";
import { useState } from "react";
import { FileSpreadsheet, DollarSign, AlertTriangle, CheckCircle, Clock, Plus, Pencil, Trash } from "lucide-react";
import { useClientes } from "../hooks/useClientes";
import { useVenta } from "../hooks/useVenta";

export default function Ventas() {
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { ventas, isLoading: isLoadingVentas, fetchVentas } = useVenta();
    const { clientes, isLoading: isLoadingClientes } = useClientes();

    const totalVentas = ventas
        ? ventas.reduce((acc, v) => acc + Number(v.monto_total), 0)
        : 0;

    const facturasEmitidas = ventas ? ventas.length : 0;

    const porCobrar = ventas
        ? ventas.filter(v => v.estado === 'Pendiente').reduce((acc, v) => acc + Number(v.monto_total), 0)
        : 0;

    const formatCurrency = (amount) => `C$${Number(amount || 0).toFixed(2)}`;

    const getClientName = (clientId) => {
        if (isLoadingClientes || !clientes) return '...';
        const client = clientes.find(c => c.id_cliente === clientId);
        return client ? client.nombre : 'Cliente General';
    };

    const getStatusBadge = (estado) => {
        switch (estado) {
            case 'Pagada':
                return <span className="justify-center items-center text-center flex gap-5 font-semibold"><CheckCircle size={15} color="green" />Cancelado</span>;
            case 'Pendiente':
                return <span className="bg-yellow-600/20 text-yellow-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"><Clock size={12} />Pendiente</span>;
            default:
                return <span className="bg-gray-600/20 text-gray-300 px-2 py-1 rounded text-xs font-medium flex items-center gap-1"><AlertTriangle size={12} /> {estado}</span>;
        }

    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
    };


    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <StatsCards title={"Total Ventas"} icon={<DollarSign className="text-title" />} value={formatCurrency(totalVentas)} />
                <StatsCards title={"Facturas Emitidas"} icon={<FileSpreadsheet className="text-title" />} value={facturasEmitidas} />
                <StatsCards title={"Por Cobrar"} icon={<AlertTriangle className="text-title" />} value={formatCurrency(porCobrar)} />
                <StatsCards title={"Borradores"} value={"0"} />
            </div>

            <div className="mt-6">
                <div className="mt-8 border border-secondary rounded-2xl p-5">
                    <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-title text-xl font-bold">Gestión de Ventas</h3>
                            <p className="text-subtitle text-s">Registra y administra tus ventas</p>
                        </div>
                        <button
                            className="btn-new bg-button text-button flex flex-row h-10 gap-3 p-2 rounded-xl items-center cursor-pointer hover:opacity-95 hover:scale-110 transition"
                            onClick={() => setIsModalOpen(true)}
                        >
                            <span className="icon"><Plus /></span> Nueva Venta
                        </button>
                    </div>

                    <div className="overflow-x-auto mt-6">
                        <table className="w-full min-w-[700px] text-left">
                            <thead>
                                <tr className="border-b border-secondary/50">
                                    <th className="p-4 text-center text-title font-semibold text-sm">Factura</th>
                                    <th className="p-4 text-center text-title font-semibold text-sm">Cliente</th>
                                    <th className="p-4 text-center text-title font-semibold text-sm">Fecha</th>
                                    <th className="p-4 text-center text-title font-semibold text-sm">Plazo de Dias</th>
                                    <th className="p-4 text-center text-title font-semibold text-sm">Total</th>
                                    <th className="p-4 text-center text-title font-semibold text-sm">Estado</th>
                                    <th className="p-4 text-center text-title font-semibold text-sm">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoadingVentas && (
                                    <tr>
                                        <td colSpan="6" className="p-4 text-center text-subtitle">
                                            Cargando ventas...
                                        </td>
                                    </tr>
                                )}

                                {!isLoadingVentas && ventas && ventas.length === 0 && (
                                    <tr>
                                        <td colSpan="6" className="p-4 text-center text-subtitle">
                                            No hay ventas registradas. Comienza creando una nueva.
                                        </td>
                                    </tr>
                                )}

                                {!isLoadingVentas && ventas && ventas.map(venta => (
                                    <tr key={venta.id_venta} className="hover:bg-secondary/20 transition-colors">
                                        <td className="p-4 text-center text-title font-medium">{venta.numero_factura}</td>
                                        <td className="p-4 text-center text-subtitle">{getClientName(venta.id_cliente)}</td>
                                        <td className="p-4 text-center text-subtitle">{new Date(venta.fecha_venta).toLocaleDateString('es-NI', { timeZone: 'UTC' })}</td>
                                        <td className="p-4 text-center text-subtitle">{venta.plazo_dias ? `${venta.plazo_dias} días` : "N/A"}</td>
                                        <td className="p-4 text-center text-title">{formatCurrency(venta.monto_total)}</td>
                                        <td className="p-4 text-center">{getStatusBadge(venta.estado)}</td>
                                        <td className="p-4 flex gap-5 text-center justify-center">
                                            <button className="text-blue-400 cursor-pointer hover:text-blue-300 transition-colors" aria-label="Editar">
                                                <Pencil size={16} />
                                            </button>
                                            <button className="text-red-500 cursor-pointer hover:text-red-400 transition-colors" aria-label="Eliminar">
                                                <Trash size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={handleCloseModal}></div>
                    <div className="relative z-10 mx-4">
                        <NuevaVenta onClose={handleCloseModal} />
                    </div>
                </div>
            )}
        </div>
    );
}