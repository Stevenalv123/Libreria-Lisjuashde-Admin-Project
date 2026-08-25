import { Plus, Save } from 'lucide-react';
import NuevaCategoria from "../components/nuevaCategoria";
import { useCategorias } from '../hooks/useCategorias';
import { useEffect, useState } from 'react';
import { useUnidadesMedidas } from '../hooks/useUnidadesMedidas';
import { useProveedores } from '../hooks/useProveedores';
import { toast } from "react-hot-toast";
import { supabase } from '../supabase/supabaseclient';
import { useEmpresa } from '../contexts/empresacontext';

export default function NuevoProducto({ onClose, onProductoAgregado }) {
    const { categorias, agregarCategoria } = useCategorias();
    const { unidadesMedidas } = useUnidadesMedidas();
    const { proveedores } = useProveedores();
    const { empresaId: empresaSeleccionada } = useEmpresa();
    const [listaCategorias, setListaCategorias] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [categoriaId, setCategoriaId] = useState('');
    const [unidadMedidaId, setUnidadMedidaId] = useState(''); 
    const [proveedorId, setProveedorId] = useState('');

    // --- 1. AÑADIR ESTADOS PARA EL PAGO ---
    const [tipoPago, setTipoPago] = useState('credito'); // 'credito', 'efectivo', 'parcial'
    const [montoParcial, setMontoParcial] = useState(0);

    // --- Estados para la sincronización con la tienda web ---
    const [imagenFile, setImagenFile] = useState(null);
    const [imagenPreview, setImagenPreview] = useState(null);
    const [visibleWeb, setVisibleWeb] = useState(true);
    const [materia, setMateria] = useState('');
    const [subiendoImagen, setSubiendoImagen] = useState(false);

    const handleImagenChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImagenFile(file);
        setImagenPreview(URL.createObjectURL(file));
    };

    // Sube la imagen al bucket público product-images y devuelve la URL pública.
    const subirImagen = async () => {
        if (!imagenFile) return null;
        setSubiendoImagen(true);
        try {
            const ext = imagenFile.name.split('.').pop();
            const path = `empresa-${empresaSeleccionada}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
            const { error } = await supabase.storage
                .from('product-images')
                .upload(path, imagenFile, { cacheControl: '3600', upsert: false });
            if (error) throw error;
            const { data } = supabase.storage.from('product-images').getPublicUrl(path);
            return data?.publicUrl || null;
        } catch (err) {
            console.error('Error subiendo imagen:', err.message);
            toast.error('No se pudo subir la imagen, el producto se guardará sin foto.');
            return null;
        } finally {
            setSubiendoImagen(false);
        }
    };

    useEffect(() => {
        setListaCategorias(categorias);
    }, [categorias]);

    const handleSaveCategoria = async (nuevaCat) => {
        // ... (tu lógica de guardar categoría sigue igual) ...
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const form = e.target;

        // --- (Lógica de SKU sigue igual) ---
        let codigoSku = "";
        const base = form["nombre"].value.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z]/g, "").substring(0, 3);
        try {
            const { data, error } = await supabase.from("productos").select("codigo_sku").eq("id_empresa", empresaSeleccionada).ilike("codigo_sku", `SKU-${base}-%`);
            if (error) throw error;
            const siguienteNumero = (data?.length || 0) + 1;
            const numeroFormateado = String(siguienteNumero).padStart(3, "0");
            codigoSku = `SKU-${base}-${numeroFormateado}`;
        } catch (err) {
            console.error("Error al generar SKU automático:", err);
            codigoSku = `SKU-${base}-001`; 
        }

        // Subir imagen (si el usuario seleccionó una) antes de crear el producto.
        const imagenUrl = await subirImagen();

        // --- Objeto del Producto (igual) ---
        const nuevoProducto = {
            id_categoria: categoriaId || null,
            codigo_sku: codigoSku,
            nombre: form["nombre"].value.trim(),
            descripcion: form["descripcion"].value.trim(),
            precio_compra: parseFloat(form["costo-unitario"].value) || 0,
            precio_venta: parseFloat(form["precio-unitario"].value) || 0,
            stock: parseInt(form["cantidad-inicial"].value) || 0,
            stock_minimo: parseInt(form["stock-minimo"].value) || 0,
            id_unidad_medida: parseInt(unidadMedidaId) || null, 
            id_proveedor: parseInt(proveedorId) || null,
            fecha_vencimiento: form["fechavencimiento"].value || null,
            estado: true,
            // Campos para la tienda web
            visible_web: visibleWeb,
            imagen_principal: imagenUrl,
            materia: materia.trim() || null,
        };

        // --- 3. CONSTRUIR OBJETO infoPago Y VALIDAR ---
        const costoTotal = nuevoProducto.precio_compra * nuevoProducto.stock;
        let infoPago = { tipo: tipoPago };

        if (tipoPago === 'parcial') {
            const montoParcialNum = parseFloat(montoParcial);
            if (montoParcialNum <= 0) {
                toast.error("⚠️ Para pago parcial, el monto pagado debe ser mayor a cero.");
                return; // Detiene el envío
            }
            if (montoParcialNum >= costoTotal) {
                toast.error("⚠️ El monto parcial no puede ser mayor o igual al costo total. Use 'Efectivo'.");
                return; // Detiene el envío
            }
            infoPago.montoEfectivo = montoParcialNum;
        }

        // --- LLAMADA ACTUALIZADA ---
        // Ahora pasamos ambos objetos al hook
        const result = await onProductoAgregado(nuevoProducto, infoPago);

        if (result.success) {
            toast.success(`✅ Producto agregado correctamente (SKU: ${codigoSku})`);
            onClose();
        } else {
            // 'errorPr' no está definido, lo quité.
            toast.error(`⚠️ ${result.message || "Error al agregar producto"}`);
        }
    };

    return (
        <>
            <div className="bg-primary text-title p-8 rounded-2xl w-full max-w-4xl shadow-lg animate-fade-in border-1 border-secondary">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-semibold">Nuevo Producto</h3>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                        
                        {/* --- Campos de Producto (iguales) --- */}
                        <div className="flex flex-col gap-2">
                            <label htmlFor="nombre" className="text-sm font-medium text-title">Nombre</label>
                            <input id="nombre" type="text" placeholder="Nombre del producto" required className="bg-input border border-secondary rounded-lg p-3 focus:ring-blue-500 focus:border-blue-500 transition" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="categoria" className="text-sm font-medium text-title">Categoría</label>
                            <div className="flex flex-row gap-2 items-center">
                                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="bg-input border border-secondary flex-1 rounded-lg p-3 appearance-none focus:ring-blue-500 focus:border-blue-500 transition">
                                    <option value="">Seleccione categoría</option>
                                    {listaCategorias.map(c => (
                                        <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setIsModalOpen(true)} className="btn-new flex bg-button text-button p-3 rounded-lg hover:opacity-95 transition-transform duration-200 ease-in-out hover:scale-110 cursor-pointer">
                                    <span className="icon"><Plus /></span>
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="cantidad-inicial" className="text-sm font-medium text-title">Cantidad Inicial</label>
                            <input id="cantidad-inicial" type="number" defaultValue="0" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>
                        <div className="md:col-span-3 flex flex-col gap-2">
                            <label htmlFor="descripcion" className="text-sm font-medium text-title">Descripción</label>
                            <input id="descripcion" type="text" placeholder="Descripción detallada" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="stock-minimo" className="text-sm font-medium text-title">Stock Mínimo</label>
                            <input id="stock-minimo" type="number" defaultValue="0" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="costo-unitario" className="text-sm font-medium text-title">Costo Unitario</label>
                            <input id="costo-unitario" type="number" step="0.01" defaultValue="0" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="precio-unitario" className="text-sm font-medium text-title">Precio Unitario</label>
                            <input id="precio-unitario" type="number" step="0.01" defaultValue="0" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="unidadmedida" className="text-sm font-medium text-title">Unidad de Medida</label>
                            <select id="unidadmedida" value={unidadMedidaId} onChange={(e) => setUnidadMedidaId(e.target.value)} className="bg-input border border-secondary rounded-lg p-3">
                                <option value="">Seleccione una unidad</option>
                                {unidadesMedidas.map(u => (
                                    <option key={u.id_unidad_medida} value={u.id_unidad_medida}>{u.nombre} ({u.abreviatura})</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2"> 
                            <label htmlFor="proveedor" className="text-sm font-medium text-title">Proveedor</label> 
                            <select id="proveedores" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} className="bg-input border border-secondary rounded-lg p-3 appearance-none focus:ring-blue-500 focus:border-blue-500 transition"> 
                                <option value="">Seleccione un proveedor</option> 
                                {proveedores.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre_comercial}</option>
                                ))} 
                            </select> 
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="fechavencimiento" className="text-sm font-medium text-title">Fecha de Vencimiento</label>
                            <input id="fechavencimiento" type="date" className="bg-input border border-secondary rounded-lg p-3 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer" />
                        </div>

                        {/* --- SECCIÓN TIENDA WEB --- */}
                        <div className="md:col-span-3 border-t border-secondary pt-5 mt-1">
                            <h4 className="text-title font-semibold mb-1">Tienda en línea</h4>
                            <p className="text-subtitle text-sm">Configura cómo se mostrará este producto en la tienda web de los clientes.</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="imagen" className="text-sm font-medium text-title">Imagen del producto</label>
                            <input id="imagen" type="file" accept="image/*" onChange={handleImagenChange} className="bg-input border border-secondary rounded-lg p-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-button file:text-button file:px-3 file:py-1.5 file:cursor-pointer" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="materia" className="text-sm font-medium text-title">Materia / Uso (opcional)</label>
                            <input id="materia" type="text" value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Ej. Matemáticas, Arte..." className="bg-input border border-secondary rounded-lg p-3" />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Mostrar en tienda web</label>
                            <label className="flex items-center gap-2 cursor-pointer bg-input border border-secondary rounded-lg p-3">
                                <input type="checkbox" checked={visibleWeb} onChange={(e) => setVisibleWeb(e.target.checked)} className="w-5 h-5 accent-blue-600" />
                                <span className="text-title text-sm">{visibleWeb ? "Visible para clientes" : "Oculto (solo interno)"}</span>
                            </label>
                        </div>
                        {imagenPreview && (
                            <div className="md:col-span-3 flex items-center gap-3">
                                <img src={imagenPreview} alt="Vista previa" className="h-24 w-24 object-cover rounded-lg border border-secondary" />
                                <span className="text-subtitle text-sm">Vista previa de la imagen</span>
                            </div>
                        )}

                        {/* --- SECCIÓN PAGO DE COMPRA --- */}
                        <div className="md:col-span-3 border-t border-secondary pt-5 mt-1">
                            <h4 className="text-title font-semibold">Compra de inventario</h4>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label htmlFor="tipo-pago" className="text-sm font-medium text-title">Método de Pago</label>
                            <select 
                                id="tipo-pago" 
                                value={tipoPago} 
                                onChange={(e) => setTipoPago(e.target.value)} 
                                className="bg-input border border-secondary rounded-lg p-3"
                            >
                                <option value="credito">Crédito (A Proveedores)</option>
                                <option value="efectivo">Efectivo (De Caja)</option>
                                <option value="parcial">Pago Parcial</option>
                            </select>
                        </div>

                        {/* Campo condicional para el monto parcial */}
                        {tipoPago === 'parcial' && (
                            <div className="flex flex-col gap-2">
                                <label htmlFor="monto-parcial" className="text-sm font-medium text-title">Monto Pagado (Efectivo)</label>
                                <input 
                                    id="monto-parcial" 
                                    type="number" 
                                    step="0.01" 
                                    value={montoParcial}
                                    onChange={(e) => setMontoParcial(e.target.value)} // Guardamos como string, convertimos en submit
                                    className="bg-input border border-secondary rounded-lg p-3" 
                                    placeholder="C$ 0.00"
                                    required // Es requerido si se selecciona 'parcial'
                                />
                            </div>
                        )}
                        {/* --- FIN DE CAMPOS DE PAGO --- */}

                    </div>

                    <div className="flex justify-end gap-4 mt-8">
                        <button typet="button" onClick={onClose} className="bg-secondary text-button-text cursor-pointer border border-secondary py-2 px-6 rounded-lg hover:bg-secondary transition-transform hover:scale-110">
                            Cancelar
                        </button>
                        <button type="submit" className="bg-button text-button py-2 cursor-pointer px-4 rounded-lg hover:bg-[#E8E8E8] transition-transform hover:scale-110 flex items-center gap-2">
                            <span className="icon"><Save /></span>
                            Guardar
                        </button>
                    </div>
                </form>
            </div>

            <NuevaCategoria isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveCategoria} />
        </>
    );
}