import { Plus, Save } from 'lucide-react';
import { useCiudadesPaises } from '../hooks/useCiudadesPaises';
import { useCategorias } from '../hooks/useCategorias';
import NuevaCategoria from "../components/nuevaCategoria"
import { useEffect, useState } from 'react';
import { toast } from "react-hot-toast"
import { useProveedores } from "../hooks/useProveedores"

export default function NuevoProveedor({ onClose }) {
    const { paises, ciudades, paisSeleccionado, error, setPaisSeleccionado } = useCiudadesPaises();
    const { categorias, errorC, agregarCategoria } = useCategorias();
    const { proveedores, agregarProveedor } = useProveedores();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [listaCategorias, setListaCategorias] = useState([]);

    const [nombreComercial, setNombreComercial] = useState('');
    const [razonSocial, setRazonSocial] = useState('');
    const [categoriaId, setCategoriaId] = useState('');
    const [email, setEmail] = useState('');
    const [telefono, setTelefono] = useState('');
    const [direccion, setDireccion] = useState('');
    const [paisId, setPaisId] = useState('');
    const [ciudadId, setCiudadId] = useState('');
    const [diasDePago, setDiasDePago] = useState('');
    const [limiteCredito, setLimiteCredito] = useState('');

    useEffect(() => {
        setListaCategorias(categorias);
    }, [categorias]);

    const handleSaveCategoria = async (nuevaCat) => {
        const result = await agregarCategoria(nuevaCat.nombre, nuevaCat.descripcion);
        if (result.success) {
            setListaCategorias((prev) => [...prev, result.data]);
            setIsModalOpen(false);
            toast.success("✅ Categoría agregada correctamente", {
                style: {
                    backgroundColor: "rgb(34, 197, 94, 0.9)",
                    color: "#fff",
                    borderRadius: "12px",
                    padding: "12px 16px",
                }
            });

        } else {
            toast.error(`⚠️ ${result.message || "Error al guardar categoría"}`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!nombreComercial || !categoriaId) {
            toast.error("❌ Por favor complete los campos obligatorios.");
            return;
        }

        const result = await agregarProveedor({
            nombre_comercial: nombreComercial,
            razon_social: razonSocial,
            id_categoria: categoriaId,
            email,
            telefono,
            direccion,
            id_pais: paisId,
            id_ciudad: ciudadId,
            dias_de_pago: diasDePago ? parseInt(diasDePago) : null,
            limite_credito: limiteCredito ? parseFloat(limiteCredito) : null
        });

        if (result.success) {
            toast.success("✅ Proveedor agregado correctamente");
            onClose();
        } else {
            toast.error(`⚠️ ${result.message || "Error al agregar proveedor"}`);
        }
    };

    if (error) return <p>Error: {error.message}</p>;

    return (
        <>
            <div className="bg-primary text-title p-8 rounded-2xl w-full max-w-7xl shadow-lg animate-fade-in border-1 border-secondary">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-semibold">Nuevo Proveedor</h3>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Nombre Comercial</label>
                            <input type="text" required value={nombreComercial} onChange={(e) => setNombreComercial(e.target.value)} placeholder="ej: Pepsi" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Razon Social</label>
                            <input type="text" value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} placeholder="ej: PepsiCo, Inc" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Categoría</label>
                            <div className='flex flex-row gap-2 justify-between items-center'>
                                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="bg-input border border-secondary w-full rounded-lg p-3 appearance-none">
                                    <option value="">Seleccione categoría</option>
                                    {listaCategorias.map(c => (
                                        <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={() => setIsModalOpen(true)} className="btn-new bg-button text-button p-3 rounded-lg flex justify-center items-center hover:opacity-95 transition-transform duration-200 ease-in-out hover:scale-110 cursor-pointer">
                                    <Plus />
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Correo Electronico</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ej: example@gmail.com" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Telefono</label>
                            <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="8585-8585" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Limite de Credito</label>
                            <input type="number" value={limiteCredito} onChange={e => setLimiteCredito(e.target.value)} placeholder="C$ 10,000" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>

                        <div className="md:col-span-3 flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Direccion</label>
                            <input type="text" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Direccion del proveedor (opcional)" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Pais</label>
                            <select value={paisId} onChange={e => { setPaisSeleccionado(e.target.value); setPaisId(e.target.value) }} className="bg-input border border-secondary rounded-lg p-3">
                                <option value="">Seleccione un país</option>
                                {paises.map(p => <option key={p.id_pais} value={p.id_pais}>{p.paisnombre}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Ciudad</label>
                            <select value={ciudadId} onChange={e => setCiudadId(e.target.value)} disabled={!paisSeleccionado} className="bg-input border border-secondary rounded-lg p-3">
                                <option value="">{paisSeleccionado ? "Seleccione una ciudad" : "Seleccione un país primero"}</option>
                                {ciudades.map(c => <option key={c.id_estado} value={c.id_estado}>{c.estadonombre}</option>)}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-title">Dias de Pago</label>
                            <input type="number" value={diasDePago} onChange={e => setDiasDePago(e.target.value)} placeholder="ej: 30" className="bg-input border border-secondary rounded-lg p-3" />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 mt-8">
                        <button type="button" onClick={onClose} className="cursor-pointer bg-secondary text-button-text border border-secondary font-semibold py-2 px-6 rounded-lg hover:bg-button-cancel transition-transform duration-200 ease-in-out hover:scale-110">Cancelar</button>
                        <button type="submit" className="cursor-pointer bg-button text-button font-semibold py-2 px-2 rounded-lg hover:bg-[#E8E8E8] transition-transform duration-200 ease-in-out hover:scale-110 flex flex-row gap-2 items-center">
                            <Save />
                            Guardar
                        </button>
                    </div>
                </form>
            </div>

            <NuevaCategoria isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveCategoria} />
        </>
    );
}