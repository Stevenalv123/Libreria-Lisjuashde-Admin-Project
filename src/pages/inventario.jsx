import StatsCards from "../components/statscards";
import Tabs from "../components/tabs";
import NuevoProducto from "../components/nuevoProducto";
import EditarProducto from "../components/editarProducto";
import { useState, useEffect, useCallback } from "react";
import { Box, TrendingUp, TrendingDown, CircleAlert, ArrowLeftRight, Plus, ShoppingBasket, Pencil, Trash, Printer, Barcode, SlidersHorizontal, Building2 } from "lucide-react";
import { useProductos } from "../hooks/useProductos";
import { useAuth } from "../contexts/authcontext";
import { supabase } from "../supabase/supabaseclient";
import Swal from "sweetalert2";
import { toast } from "react-hot-toast";
import { generarCodigoEAN13, imprimirCodigosBarras } from "../utils/generarCodigoBarras";

const EMPRESA_ID = 1;

export default function Inventario() {
    const { perfil, rol } = useAuth();
    const esSuperadmin = rol === "superadmin";

    // Selector de sucursal: superadmin puede ver "Todas" o una sucursal;
    // los demás quedan fijados a su sucursal asignada.
    const [sucursales, setSucursales] = useState([]);
    const [sucursalSel, setSucursalSel] = useState(esSuperadmin ? "" : "");
    const [stockMap, setStockMap] = useState({}); // id_producto -> { stock, stock_minimo }

    useEffect(() => {
        supabase.from("sucursales").select("id, nombre").eq("id_empresa", EMPRESA_ID).eq("estado", true).order("id")
            .then(({ data }) => setSucursales(data || []));
    }, []);

    // Fijar la sucursal del perfil para roles no superadmin.
    useEffect(() => {
        if (!esSuperadmin && perfil?.id_sucursal) setSucursalSel(String(perfil.id_sucursal));
    }, [esSuperadmin, perfil]);

    const cargarStockSucursal = useCallback(async () => {
        if (!sucursalSel) { setStockMap({}); return; }
        const { data } = await supabase
            .from("v_stock_sucursal")
            .select("id_producto, stock, stock_minimo")
            .eq("id_sucursal", Number(sucursalSel));
        const mapa = {};
        (data || []).forEach((r) => { mapa[r.id_producto] = { stock: r.stock, stock_minimo: r.stock_minimo }; });
        setStockMap(mapa);
    }, [sucursalSel]);

    useEffect(() => { cargarStockSucursal(); }, [cargarStockSucursal]);

    // Stock a mostrar: por sucursal si hay una seleccionada; global si "Todas".
    const verPorSucursal = !!sucursalSel;
    const stockDe = (p) => verPorSucursal ? Number(stockMap[p.id_producto]?.stock ?? 0) : Number(p.stock ?? 0);
    const stockMinDe = (p) => verPorSucursal ? Number(stockMap[p.id_producto]?.stock_minimo ?? p.stock_minimo ?? 0) : Number(p.stock_minimo ?? 0);

    const ajustarStock = async (p) => {
        if (!verPorSucursal) { toast.error("Seleccione una sucursal para ajustar el stock físico."); return; }
        const { value } = await Swal.fire({
            title: `Ajustar stock físico`,
            html: `<p style="font-size:14px;margin-bottom:8px">${p.nombre}</p>`,
            input: "number",
            inputValue: stockDe(p),
            inputLabel: `Nuevo stock contado en la sucursal`,
            background: "#152235", color: "#fff",
            showCancelButton: true, confirmButtonText: "Guardar ajuste", cancelButtonText: "Cancelar",
            confirmButtonColor: "#2563eb",
            inputValidator: (v) => (v === "" || Number(v) < 0) && "Ingrese un valor válido (>= 0)",
        });
        if (value === undefined) return;
        const { error } = await supabase.rpc("sp_ajustar_stock_sucursal", {
            p_id_producto: p.id_producto,
            p_id_sucursal: Number(sucursalSel),
            p_nuevo_stock: Number(value),
        });
        if (error) { Swal.fire({ icon: "error", title: "No se pudo ajustar", text: error.message, background: "#152235", color: "#fff" }); return; }
        toast.success("Stock ajustado.");
        cargarStockSucursal();
    };

    const tabs = [
        { key: "productos", label: "Productos", icon: <ShoppingBasket size={16} /> },
        { key: "movimientos", label: "Movimientos", icon: <ArrowLeftRight size={16} /> }
    ];

    const [activeTab, setActiveTab] = useState("productos");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [productoEditando, setProductoEditando] = useState(null);
    const { productos = [], isLoading, eliminarProducto, agregarProducto, actualizarProducto, generarAsientoInicial } = useProductos();

    const valorTotalInventario = productos.reduce((total, producto) => {
        if (!producto) return total;
        return total + (stockDe(producto) * producto.precio_compra);
    }, 0);

    const codigoDe = (p) => p.codigo_barras || generarCodigoEAN13(p.id_producto);

    const imprimirUno = (p) => {
        imprimirCodigosBarras([{ codigo: codigoDe(p), nombre: p.nombre, precio: p.precio_venta }]);
    };

    const imprimirTodos = () => {
        if (!productos.length) return toast.error("No hay productos para imprimir");
        imprimirCodigosBarras(productos.map(p => ({ codigo: codigoDe(p), nombre: p.nombre, precio: p.precio_venta })));
    };

    const handleEliminarProducto = async (id, nombre) => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: `Esta acción no se puede revertir. Se eliminará el producto "${nombre}".`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
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
                const { success, message } = await eliminarProducto(id);

                if (success) {
                    toast.success('✅ Producto eliminado correctamente');
                } else {
                    toast.error(`⚠️ Error al eliminar: ${message}`);
                }
            }
        });
    };

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <StatsCards title={"Total Productos"} icon={<Box className="text-title" />} value={productos.length} />
                <StatsCards title={"Valor Inventario"} icon={<TrendingUp className="text-title" />} value={`C$${valorTotalInventario.toFixed(2)}`} /> {/* Añadido toFixed(2) */}
                <StatsCards title={"Stock Bajo"} icon={<CircleAlert color="red" />} value={productos.filter(p => stockDe(p) <= stockMinDe(p)).length} />
                <StatsCards title={"Movimientos hoy"} icon={<TrendingDown className="text-title" />} value={"0"} />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <span className="text-subtitle text-sm flex items-center gap-1.5"><Building2 size={16} /> Sucursal:</span>
                {esSuperadmin ? (
                    <select
                        value={sucursalSel}
                        onChange={(e) => setSucursalSel(e.target.value)}
                        className="bg-input text-title border border-secondary rounded-lg px-3 py-1.5 text-sm"
                    >
                        <option value="">Todas (stock global)</option>
                        {sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                ) : (
                    <span className="badge badge-info">{sucursales.find((s) => String(s.id) === sucursalSel)?.nombre || "Mi sucursal"}</span>
                )}
                {verPorSucursal && <span className="text-xs text-subtitle">Mostrando stock de la sucursal seleccionada.</span>}
            </div>

            <div className="mt-4">
                <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />
                <div className="mt-8 border border-secondary rounded-2xl p-5">
                    {activeTab === "productos" && (
                        <>
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <h3 className="text-title text-xl font-bold">Gestión de productos</h3>
                                    <p className="text-subtitle text-s">Administra el catálogo de productos del inventario</p>
                                </div>
                                <div className="flex flex-row gap-4">
                                    <button
                                        onClick={generarAsientoInicial}
                                        className="bg-yellow-500 text-black px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 hover:opacity-95 hover:scale-110 transition"
                                    >
                                        Generar Asiento Inicial
                                    </button>
                                    <button
                                        onClick={imprimirTodos}
                                        className="bg-secondary/40 text-title border border-secondary px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 hover:opacity-95 hover:scale-110 transition"
                                        title="Imprimir códigos de barra de todos los productos"
                                    >
                                        <Barcode size={18} /> Imprimir Códigos
                                    </button>
                                    <button className="btn-new bg-button text-button flex flex-row h-10 text-s gap-3 p-2 rounded-xl items-center cursor-pointer hover:opacity-95 hover:scale-110 transition" onClick={() => setIsModalOpen(true)}>
                                        <span className="icon"><Plus /></span> Nuevo Producto
                                    </button>
                                </div>

                            </div>

                            <div className="mt-8 overflow-x-auto">
                                {isLoading ? (
                                    <p className="p-4 text-center text-gray-400">Cargando productos...</p>
                                ) : productos.length === 0 ? (
                                    <p className="p-4 text-center text-gray-400">No hay productos registrados. ¡Agrega uno nuevo!</p>
                                ) : (
                                    <div className="inline-block min-w-full align-middle">
                                        <div className="overflow-hidden rounded-lg mb-8">
                                            <table className="min-w-full text-title">
                                                <thead className="bg-secondary/10">
                                                    <tr className="border-b border-secondary/50 text-sm font-semibold text-subtitle">
                                                        <th className="py-3 px-4 text-center">Código</th>
                                                        <th className="py-3 px-4 text-center">Código de Barras</th>
                                                        <th className="py-3 px-4 text-center">Nombre</th>
                                                        <th className="py-3 px-4 text-center">Categoría</th>
                                                        <th className="py-3 px-4 text-center">Precio Compra</th>
                                                        <th className="py-3 px-4 text-center">Precio Venta</th>
                                                        <th className="py-3 px-4 text-center">Stock</th>
                                                        <th className="py-3 px-4 text-center">Unidad</th>
                                                        <th className="py-3 px-4 text-center">Proveedor</th>
                                                        <th className="py-3 px-4 text-center">Fecha Registro</th>
                                                        <th className="py-3 px-4 text-center">Fecha de Vencimiento</th>
                                                        <th className="py-3 px-4 text-center">Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {productos.map((p) => (
                                                        <tr key={p.id_producto} className="border-t border-secondary text-sm hover:bg-secondary/10 transition-colors">
                                                            <td className="py-4 px-4 font-mono text-center text-gray-400">{p.codigo_sku || "-"}</td>
                                                            <td className="py-4 px-4 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <span className="font-mono text-xs text-subtitle">{codigoDe(p)}</span>
                                                                    <button title="Imprimir código de barras" onClick={() => imprimirUno(p)} className="text-title hover:text-blue-300 transition-colors transform hover:scale-110 cursor-pointer">
                                                                        <Printer size={16} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 font-medium text-center text-title">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span>{p.nombre}</span>
                                                                    {stockDe(p) <= stockMinDe(p) && (
                                                                        <span className="inline-flex items-center gap-1 bg-red-600/20 text-red-400 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                                            <CircleAlert size={11} /> Stock bajo
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-4 text-center text-subtitle">{p.categorias_producto?.nombre || "N/A"}</td>
                                                            <td className="py-4 px-4 text-center text-subtitle">C${p.precio_compra.toFixed(2)}</td>
                                                            <td className="py-4 px-4 text-center text-subtitle">C${p.precio_venta.toFixed(2)}</td>
                                                            <td className="py-4 px-4 text-center">
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stockDe(p) > stockMinDe(p)
                                                                    ? 'bg-green-600/20 text-green-400'
                                                                    : 'bg-red-600/20 text-red-400'
                                                                    }`}>
                                                                    {stockDe(p)}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-4 text-center text-subtitle">{p.unidades_medidas?.nombre || "N/A"}</td>
                                                            <td className="py-4 px-4 text-center text-subtitle">{p.proveedores?.nombre_comercial || "N/A"}</td>
                                                            <td className="py-4 px-4 text-center text-subtitle">{new Date(p.fecha_registro).toLocaleDateString()}</td>
                                                            <td className="py-4 px-4 text-center text-subtitle">{p.fecha_vencimiento ? new Date(p.fecha_vencimiento).toLocaleDateString() : "N/A"}</td>
                                                            <td className="py-4 px-4">
                                                                <div className="flex justify-center gap-6">
                                                                    {verPorSucursal && (
                                                                        <button title="Ajustar stock físico de la sucursal" onClick={() => ajustarStock(p)} className="text-amber-400 hover:text-amber-300 transition-colors transform hover:scale-110 cursor-pointer">
                                                                            <SlidersHorizontal size={18} />
                                                                        </button>
                                                                    )}
                                                                    <button title="Editar Producto" onClick={() => setProductoEditando(p)} className="text-blue-400 hover:text-blue-300 transition-colors transform hover:scale-110 cursor-pointer">
                                                                        <Pencil size={18} />
                                                                    </button>
                                                                    <button title="Eliminar Producto" className="text-red-500 hover:text-red-400 transition-colors transform hover:scale-110 cursor-pointer" onClick={() => handleEliminarProducto(p.id_producto, p.nombre)}>
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
                        <NuevoProducto onClose={() => setIsModalOpen(false)}
                            onProductoAgregado={agregarProducto} />
                    </div>
                </div>
            )}

            {productoEditando && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm">
                    <div className="absolute inset-0" onClick={() => setProductoEditando(null)}></div>
                    <div className="relative z-10 mx-4">
                        <EditarProducto
                            producto={productoEditando}
                            onClose={() => setProductoEditando(null)}
                            onGuardar={actualizarProducto}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
