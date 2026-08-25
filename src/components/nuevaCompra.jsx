// /components/NuevaCompra.jsx
import { Plus, Save, Trash } from 'lucide-react';
import { useState } from 'react';
import { useProductos } from '../hooks/useProductos';
import { toast } from "react-hot-toast";
import { useProveedores } from '../hooks/useProveedores';
import { useCompras } from '../hooks/useCompras';

const getTodayString = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
}

export default function NuevaCompra({ onClose }) {
    // Hooks de datos
    const { productos, isLoading: isLoadingProductos } = useProductos();
    const { proveedores, isLoading: isLoadingProveedores } = useProveedores();
    const { registrarCompra, isSaving } = useCompras();

    // Estados del formulario
    const [productosSeleccionados, setProductosSeleccionados] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [cantidadInput, setCantidadInput] = useState(1);
    const [costoInput, setCostoInput] = useState(0); // <-- Diferente a Venta
    const [idProveedor, setIdProveedor] = useState("");
    const [fechaCompra, setFechaCompra] = useState(getTodayString());

    const handleSubmit = async (e) => {
        e.preventDefault();
        const form = e.target;
        const tipoPago = form["tipo-pago"].value;

        if (productosSeleccionados.length === 0 || !idProveedor || idProveedor === "" || !tipoPago) {
            toast.error("Complete Proveedor, Tipo de Pago y al menos un producto.");
            return;
        }

        const compraData = {
            id_proveedor: Number(idProveedor),
            tipo_pago: tipoPago,
            fecha_compra: fechaCompra,
            detalle_compra: productosSeleccionados.map(p => ({
                "IdProducto": p.id_producto,
                "Cantidad": p.cantidad,
                "Costo": p.costo // <-- Diferente a Venta
            }))
        };

        const { success } = await registrarCompra(compraData);

        if (success) {
            onClose();
        }
    };

    const handleAddProduct = () => {
        if (!selectedProductId) return toast.error("Selecciona un producto");
        const prod = productos.find(p => String(p.id_producto) === String(selectedProductId));
        if (!prod) return toast.error("Producto no encontrado");

        const item = {
            id_producto: prod.id_producto,
            nombre: prod.nombre,
            costo: Number(costoInput),
            cantidad: Number(cantidadInput),
        };

        setProductosSeleccionados(prev => [...prev, item]);
        // Limpiar inputs
        setSelectedProductId('');
        setCantidadInput(1);
        setCostoInput(0);
    }

    return (
        <div className="bg-primary text-title p-8 rounded-2xl w-full max-w-4xl shadow-lg animate-fade-in border-1 border-secondary">
            <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-semibold">Nueva Compra</h3>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    <div className="flex flex-col gap-2">
                        <label htmlFor="proveedor" className="text-sm font-medium text-title">Proveedor</label>
                        <select id="proveedores" className="bg-input border border-secondary rounded-lg p-3 w-full" required value={idProveedor} onChange={(e) => setIdProveedor(e.target.value)}>
                            <option value="">{isLoadingProveedores ? "Cargando..." : "Seleccione un proveedor"}</option>
                            {proveedores.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.nombre_comercial}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="tipo-pago" className="text-sm font-medium text-title">Tipo de Pago</label>
                        <select id="tipo-pago" className="bg-input border border-secondary rounded-lg p-3" required>
                            <option value="credito">Crédito (Crea Cuentas por Pagar)</option>
                            <option value="contado">Contado</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label htmlFor="fecha-compra" className="text-sm font-medium text-title">Fecha de Compra</label>
                        <input
                            id="fecha-compra"
                            type="date"
                            value={fechaCompra}
                            onChange={(e) => setFechaCompra(e.target.value)}
                            className="bg-input border border-secondary rounded-lg p-3"
                            required
                        />
                    </div>

                    <div className='md:col-span-2 flex flex-col border-1 p-4 rounded-lg border-secondary'>
                        <h3 className="text-lg font-semibold text-title">Productos</h3>
                        <div className="grid grid-cols-8 gap-x-4 gap-y-4 items-end mt-4">
                            <div className="flex flex-col gap-2 col-span-3">
                                <label className="text-sm font-medium text-title">Producto</label>
                                <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="bg-input border border-secondary rounded-lg p-3">
                                    <option value="">{isLoadingProductos ? "Cargando..." : "Seleccione"}</option>
                                    {productos.map(p => (
                                        <option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-2 col-span-2">
                                <label className="text-sm font-medium text-title">Costo Unitario</label>
                                <input type="number" step="0.01" value={costoInput} onChange={(e) => setCostoInput(e.target.value)} className="bg-input border border-secondary rounded-lg p-3" />
                            </div>

                            <div className="flex flex-col gap-2 col-span-2">
                                <label className="text-sm font-medium text-title">Cantidad</label>
                                <input type="number" step="1" value={cantidadInput} onChange={(e) => setCantidadInput(e.target.value)} className="bg-input border border-secondary rounded-lg p-3" />
                            </div>

                            <div className="flex flex-col gap-2 items-end col-gap-1 w-full">
                                <button type="button" onClick={handleAddProduct} className="bg-button text-button h-12 w-full flex items-center justify-center rounded-lg">
                                    <Plus size={16} />
                                </button>
                            </div>
                        </div>

                        {productosSeleccionados.length > 0 && (
                            <table className="w-full mt-6 border-collapse">
                                <thead className="border-b border-secondary">
                                    <tr>
                                        <th className="text-center text-sm font-medium text-title">Producto</th>
                                        <th className="text-center text-sm font-medium text-title">Cantidad</th>
                                        <th className="text-center text-sm font-medium text-title">Costo</th>
                                        <th className="text-center text-sm font-medium text-title">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productosSeleccionados.map((item, index) => (
                                        <tr key={item.id_producto ?? index}>
                                            <td className="p-2 text-center">{item.nombre}</td>
                                            <td className="p-2 text-center">{item.cantidad}</td>
                                            <td className="p-2 text-center">C$ {item.costo.toFixed(2)}</td>
                                            <td className="p-2 text-center">
                                                <button type="button" onClick={() => setProductosSeleccionados(prev => prev.filter((_, i) => i !== index))} className="text-red-500 hover:text-red-700">
                                                    <Trash size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                <div className="flex justify-end mt-4">
                    {productosSeleccionados.length > 0 ? (
                        <h3 className="text-title font-semibold text-2xl">Total: C$ {productosSeleccionados.reduce((acc, item) => acc + (item.costo || 0) * (item.cantidad || 0), 0).toFixed(2)}</h3>
                    ) : (
                        <h3 className="font-semibold text-2xl">Total: C$ 0</h3>
                    )}
                </div>

                <div className="flex justify-end gap-4 mt-8">
                    <button type="button" onClick={onClose} className="cursor-pointer bg-secondary text-button-text border border-secondary font-semibold py-2 px-6 rounded-lg hover:bg-button-cancel transition-transform duration-200 ease-in-out hover:scale-110">
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || isLoadingProductos || isLoadingProveedores}
                        className="cursor-pointer bg-button text-button font-semibold py-2 px-2 rounded-lg hover:bg-[#E8E8E8] transition-transform duration-200 ease-in-out hover:scale-110 flex flex-row gap-2 items-center"
                    >
                        <Save />
                        {isSaving ? "Guardando..." : "Guardar Compra"}
                    </button>
                </div>
            </form>
        </div>
    );
}