import { useState, useEffect } from "react";
import { supabase } from "../supabase/supabaseclient";

export function useUnidadesMedidas() {
    const [unidadesMedidas, setUnidadesMedidas] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchUnidadesMedidas = async () => {
            setError(null)

            const {data, error} = await supabase
                .from("unidades_medidas")
                .select("*")
                .order("nombre", { ascending: true });

            if (error) {
                console.log("Error: ", error)
                return
            } else {
                setUnidadesMedidas(data)
            }
        };

        fetchUnidadesMedidas();
    }, []);

    return {
        unidadesMedidas, error
    }
}