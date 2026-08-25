import { useState, useEffect, useCallback } from "react"; // <-- Añade useCallback
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

export function useProveedores() {
    const { empresaId } = useEmpresa();
    const [proveedores, setProveedores] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- 1. Mueve tu lógica de fetch a un useCallback ---
    const fetchProveedores = useCallback(async () => {
        if (!empresaId) return;

        setIsLoading(true);
        setError(null);

        try {
            const { data: proveedoresData, error: proveedoresError } = await supabase
                .from("proveedores")
                .select(`
                     id_proveedor,
                     nombre_comercial,
                     razon_social,
                     email,
                     telefono,
                     direccion,
                     dias_de_pago,
                     limite_credito,
                     estado,
                     categoria:categorias_producto(nombre),
                     pais:pais(paisnombre),
                     ciudad:estado(estadonombre)
                `)
                .eq("id_empresa", empresaId);

            if (proveedoresError) throw proveedoresError;

            const proveedoresFormateados = proveedoresData.map(p => ({
                id: p.id_proveedor,
                nombre_comercial: p.nombre_comercial,
                razon_social: p.razon_social,
                categoria: p.categoria?.nombre || "",
                email: p.email,
                telefono: p.telefono,
                direccion: p.direccion,
                pais: p.pais?.paisnombre || "",
                ciudad: p.ciudad?.estadonombre || "",
                dias_de_pago: p.dias_de_pago,
                limite_credito: p.limite_credito,
                estado: p.estado === true || p.estado === 1 || p.estado === "1" || p.estado === "t" ? 1 : 0
            }));

            setProveedores(proveedoresFormateados);
        } catch (err) {
            console.error("Error al cargar proveedores:", err);
            setError(err.message || "Error desconocido");
        } finally {
            setIsLoading(false);
        }
    }, [empresaId]); // Depende de empresaId

    // --- 2. Llama a la función de fetch en un useEffect ---
    useEffect(() => {
        fetchProveedores();
    }, [fetchProveedores]); // Se ejecutará cuando cambie empresaId

    const agregarProveedor = async ({
        // ... (todos tus parámetros) ...
        nombre_comercial, razon_social, id_categoria, email,
        telefono, direccion, id_pais, id_ciudad,
        dias_de_pago, limite_credito, estado = 1
    }) => {
        if (!empresaId) return { success: false, message: "No hay empresa seleccionada." };

        try {
            // ... (tu validación de proveedor existente) ...
            const { data: existente, error: errorExistente } = await supabase
                .from("proveedores")
                .select("id_proveedor")
                .eq("id_empresa", empresaId)
                .or(`nombre_comercial.eq.${nombre_comercial},email.eq.${email}`)
                .maybeSingle();

            if (errorExistente) throw errorExistente;
            if (existente) {
                return { success: false, message: "Ya existe un proveedor con ese nombre o email." };
            }

            const { data, error: errorInsert } = await supabase
                .from("proveedores")
                .insert([{
                    id_empresa: empresaId,
                    nombre_comercial, razon_social, id_categoria, email,
                    telefono, direccion, id_pais, id_ciudad,
                    dias_de_pago, limite_credito, estado
                }])
                .select()
                .single(); // <-- 3. Simplifica, solo necesitas el ID

            if (errorInsert) throw errorInsert;

            // --- 4. LA SOLUCIÓN ---
            // En lugar de actualizar el estado manualmente,
            // simplemente vuelve a llamar a la función que carga todo.
            // Esto asegura que los datos (incluyendo joins) son 100% correctos.
            await fetchProveedores();

            return { success: true, data: data }; // Devuelve el proveedor insertado
        } catch (err) {
            console.error("Error al agregar proveedor:", err);
            return { success: false, message: err.message || "Error desconocido" };
        }
    };

    return { proveedores, isLoading, error, agregarProveedor };
}