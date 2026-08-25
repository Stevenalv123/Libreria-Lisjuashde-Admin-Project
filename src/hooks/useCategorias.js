import { useState, useEffect } from "react";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";

export function useCategorias() {
    const [categorias, setCategorias] = useState([]);
    const [error, setError] = useState(null);
    const { empresaId } = useEmpresa();

    useEffect(() => {
        const fetchCategorias = async () => {
            if (!empresaId) return;
            setError(null);

            const { data, error } = await supabase
                .from("categorias_producto")
                .select("*")
                .eq("id_empresa", empresaId)
                .order("nombre", { ascending: true });

            if (error) {
                console.log("ERROR: ", error);
            } else {
                setCategorias(data || []);
            }
        };

        fetchCategorias();
    }, [empresaId]);

    const agregarCategoria = async (nombre, descripcion) => {
        if (!empresaId) return { success: false, message: "No hay empresa seleccionada." };

        const { data: existente, error: errorExistente } = await supabase
            .from("categorias_producto")
            .select("id_categoria")
            .eq("id_empresa", empresaId)
            .eq("nombre", nombre.trim())
            .maybeSingle();

        if (errorExistente) {
            console.log("Error al verificar duplicado:", errorExistente);
            return { success: false, message: "Error al verificar duplicado." };
        }

        if (existente) {
            return { success: false, message: "La categoría ya existe en esta empresa." };
        }

        const { data, error } = await supabase
            .from("categorias_producto")
            .insert([{ id_empresa: empresaId, nombre: nombre.trim(), descripcion }])
            .select();

        if (error) {
            console.log("Error al insertar categoria: ", error);
            setError(error.message);
            return { success: false, message: "Error al guardar la categoría." };
        }

        setCategorias((prev) => [...prev, ...data]);
        return { success: true, data: data[0] };
    };

    return {
        categorias,
        error,
        agregarCategoria,
    };
}
