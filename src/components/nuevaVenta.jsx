import { Plus, Save, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProductos } from '../hooks/useProductos';
import { toast } from "react-hot-toast";
import { useVenta } from '../hooks/useVenta';
import { useClientes } from '../hooks/useClientes';

const getFormattedDate = () => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${mm}${dd}${yyyy}`;
};

const calcularDias = (fecha, vencimiento) => {
    if (!fecha || !vencimiento) return null;
    try {
        const date1 = new Date(fecha);
        const date2 = new Date(vencimiento);
        const diffTime = Math.abs(date2.getTime() - date1.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    } catch (error) {
        console.error("Error calculando días:", error);
        return null;
    }
};

export default function NuevaVenta({ onClose }) {
    const [productosSeleccionados, setProductosSeleccionados] = useState([]);
    const { productos } = useProductos();
    const { clientes } = useClientes();
    const [selectedProductId, setSelectedProductId] = useState('');
    const [cantidadInput, setCantidadInput] = useState(1);
    const [descuentoInput, setDescuentoInput] = useState(0);
    const { crearVenta, ventas } = useVenta();
    const [numeroFactura, setNumeroFactura] = useState('Generando...');

    useEffect(() => {
        if (ventas && Array.isArray(ventas)) {
            const todayStr = getFormattedDate();

            const ventasDeHoy = ventas.filter(venta =>
                venta.numero_factura && typeof venta.numero_factura === 'string' && venta.numero_factura.startsWith(todayStr)
            );

            const proximoNumero = ventasDeHoy.length + 1;

            const numeroGenerado = `${todayStr}-${String(proximoNumero).padStart(4, '0')}`;

            setNumeroFactura(numeroGenerado);
        } else if (ventas === null || ventas === undefined) {
            setNumeroFactura('Cargando...');
        } else {
            const todayStr = getFormattedDate();
            setNumeroFactura(`${todayStr}-0001`);
        }
    }, [ventas]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        const form = e.target;
        const cliente = form.cliente.value;
        const tipoPago = form["tipo-pago"].value;
        const referencia = form.referencia.value;
        const fecha = form.fecha.value;
        const vencimiento = form.fechavencimiento.value;

        if (productosSeleccionados.length === 0) {
            toast.error("Debes agregar al menos un producto");
            return;
        }

        const ventaData = {
            numero_factura: numeroFactura,
            id_cliente: cliente || null,
            tipo_pago: tipoPago,
            plazo_dias: tipoPago === 'credito' ? calcularDias(fecha, vencimiento) : 0,
            fechavencimiento: tipoPago === 'credito' ? vencimiento : null,
            detalle_items: productosSeleccionados.map(p => ({
                "IdProducto": p.id_producto,
                "Cantidad": p.cantidad
            }))
        };

        if (numeroFactura === 'Generando...' || numeroFactura === 'Cargando...') {
            toast.error("Espere a que se genere el número de factura");
            return;
        }

        const idVenta = await crearVenta(ventaData);

        if (idVenta) {
            toast.success(`✅ Venta creada correctamente (ID: ${idVenta})`);
            onClose();
        } else {
            toast.error("⚠️ Error al crear la venta");
        }
    };

    const handleAddProduct = () => {
        if (!selectedProductId) return toast.error("Selecciona un producto");

        const prod = productos.find(p => String(p.id_producto) === String(selectedProductId));
        if (!prod) return toast.error("Producto no encontrado");

        if (productosSeleccionados.some(p => p.id_producto === prod.id_producto)) {
            toast.error("El producto ya fue agregado");
            return;
        }

        const precio = prod.precio_venta ?? prod.precio ?? prod.precio_compra ?? 0;
        const item = {
            id_producto: prod.id_producto,
            nombre: prod.nombre,
            precio,
            cantidad: Number(cantidadInput),
            descuento: Number(descuentoInput),
        };

        setProductosSeleccionados(prev => [...prev, item]);
        setSelectedProductId('');
        setCantidadInput(1);
        setDescuentoInput(0);
    }



    return (
        <>
            <div className="bg-primary text-title p-8 rounded-2xl w-full max-w-4xl shadow-lg animate-fade-in border-1 border-secondary">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-semibold">Nueva Venta</h3>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                        <div className="flex flex-col gap-2">
                            <label htmlFor="numeroFactura" className="text-sm font-medium text-title">Numero de Factura</label>
                            <input id="numeroFactura" name="numeroFactura" type="text" value={numeroFactura} readOnly required placeholder="10262025-001" className="bg-input border border-secondary rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500 transition" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="cliente" className="text-sm font-medium text-title">Cliente</label>
                            <div className="flex flex-row gap-2 items-center">
                                <select id="cliente" className="bg-input border border-secondary rounded-lg p-3 w-full ">
                                    <option value="">Seleccione un cliente</option>
                                    {clientes.map(c => (
                                        <option key={c.id_cliente} value={c.id_cliente}>
                                            {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="fecha" className="text-sm font-medium text-title">Fecha</label>
                            <input
                                id="fecha"
                                type="date"
                                defaultValue={new Date().toISOString().slice(0, 10)}
                                className="bg-input border border-secondary rounded-lg p-3"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="fechavencimiento" className="text-sm font-medium text-title">Fecha de Vencimiento</label>
                            <input id="fechavencimiento" type="date" className="bg-input border border-secondary rounded-lg p-3 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="tipo-pago" className="text-sm font-medium text-title">Tipo de Pago</label>
                            <select id="tipo-pago" className="bg-input border border-secondary rounded-lg p-3">
                                <option value="">Seleccione un tipo de pago</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="tarjeta">Tarjeta de Crédito</option>
                                <option value="transferencia">Transferencia Bancaria</option>
                                <option value="credito">Credito</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label htmlFor="referencia" className="text-sm font-medium text-title">Referencia</label>
                            <input id="referencia" type="text" placeholder="Referencia de la venta (Opcional)" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>

                        <div className='md:col-span-3 flex flex-col border-1 p-4 rounded-lg border-secondary'>
                            <h3 className="text-lg font-semibold text-title">Productos</h3>
                            <p className='text-sm text-subtitle mb-4'>Agrega los productos que deseas vender</p>
                            <div className="grid grid-cols-8 gap-x-4 gap-y-4 items-end">
                                <div className="flex flex-col gap-2 col-span-3">
                                    <label htmlFor="producto" className="text-sm font-medium text-title">Producto</label>
                                    <select id="producto" value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="bg-input border border-secondary rounded-lg p-3">
                                        <option value="">Seleccione un producto</option>
                                        {productos.map(p => (
                                            <option key={p.id_producto} value={p.id_producto}>{p.nombre}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex flex-col gap-2 col-span-2">
                                    <label htmlFor="cantidad" className="text-sm font-medium text-title">Cantidad</label>
                                    <input id="cantidad" type="number" step="0.01" value={cantidadInput} onChange={(e) => setCantidadInput(e.target.value)} className="bg-input border border-secondary rounded-lg p-3" />
                                </div>

                                <div className="flex flex-col gap-2 col-span-2">
                                    <label htmlFor="descuento" className="text-sm font-medium text-title">Descuento</label>
                                    <input id="descuento" type="number" step="1" value={descuentoInput} onChange={(e) => setDescuentoInput(e.target.value)} placeholder='15%' className="bg-input border border-secondary rounded-lg p-3" />
                                </div>

                                <div className="flex flex-col gap-2 items-end col-gap-1 w-full">
                                    <button type="button" onClick={handleAddProduct} className="bg-button text-button h-12 cursor-pointer w-full flex items-center justify-center rounded-md hover:bg-[#E8E8E8] transition-transform hover:scale-110" aria-label="Agregar producto">
                                        <span className="icon"><Plus size={16} /></span>
                                    </button>
                                </div>
                            </div>


                            {productosSeleccionados.length > 0 && (
                                <table className="w-full mt-6 border-collapse">
                                    <thead className='border-b-1 border-secondary'>
                                        <tr>
                                            <th className="text-center text-sm font-medium text-title">Producto</th>
                                            <th className="text-center text-sm font-medium text-title">Precio</th>
                                            <th className="text-center text-sm font-medium text-title">Cantidad</th>
                                            <th className="text-center text-sm font-medium text-title">Descuento</th>
                                            <th className="text-center text-sm font-medium text-title">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {productosSeleccionados.map((item, index) => (
                                            <tr key={item.id_producto ?? index}>
                                                <td className="p-2 text-center">{item.nombre}</td>
                                                <td className="p-2 text-center">{item.precio}</td>
                                                <td className="p-2 text-center">{item.cantidad}</td>
                                                <td className="p-2 text-center">{item.descuento}%</td>
                                                <td className="p-2 text-center">
                                                    <button type="button" onClick={() => setProductosSeleccionados(prev => prev.filter((_, i) => i !== index))} className="text-red-500 cursor-pointer hover:text-red-700 transition-transform hover:scale-110 flex items-center justify-center w-8 h-8 mx-auto">
                                                        <span className="icon"><Trash size={18} /></span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <div className="flex justify-end mt-4">
                                Productos Seleccionados: {productosSeleccionados.length}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end mt-4">
                        {productosSeleccionados.length > 0 ? (
                            <h3 className="text-title font-semibold text-2xl">Total: C$ {productosSeleccionados.reduce((acc, item) => acc + (item.precio || 0) * (item.cantidad || 0) * (1 - (item.descuento || 0) / 100), 0).toFixed(2)}</h3>
                        ) : (
                            <h3 className="font-semibold text-2xl">Total: C$ 0</h3>
                        )}
                    </div>

                    <div className="flex justify-end gap-4 mt-8">
                        <button type="button" onClick={onClose} className="bg-secondary text-button-text cursor-pointer border border-secondary py-2 px-6 rounded-lg hover:bg-secondary transition-transform hover:scale-110">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-button text-button py-2 cursor-pointer px-4 rounded-lg hover:bg-[#E8E8E8] transition-transform hover:scale-110 flex items-center gap-2">
                            <span className="icon"><Save /></span>
                            Guardar
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}
