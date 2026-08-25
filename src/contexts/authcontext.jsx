import { createContext, useEffect, useState, useContext } from "react";
import { supabase } from "../supabase/supabaseclient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(null);   // { rol, nombre_completo, ... }
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (userId) => {
    if (!userId) { setPerfil(null); return null; }
    const { data, error } = await supabase
      .from("perfiles")
      .select("id, nombre_completo, email, telefono, rol, id_empresa")
      .eq("id", userId)
      .single();
    if (error) { console.error("Error cargando perfil:", error.message); setPerfil(null); return null; }
    setPerfil(data);
    return data;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) await cargarPerfil(session.user.id);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session?.user) await cargarPerfil(session.user.id);
      else setPerfil(null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loginUser = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error("Error login:", error);
      return { success: false, error: error.message };
    }
    // Verificar que el usuario sea STAFF (admin/vendedor/cajero). Los clientes NO entran aquí.
    const p = await cargarPerfil(data.user.id);
    if (!p || !["admin", "vendedor", "cajero"].includes(p.rol)) {
      await supabase.auth.signOut();
      return { success: false, error: "Esta cuenta no tiene acceso al panel administrativo." };
    }
    return { success: true, data, perfil: p };
  };

  // Registro de nuevo miembro del staff (solo lo usará un admin desde Personal/Usuarios)
  const signUpStaff = async (email, password, nombre_completo, rol = "vendedor") => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre_completo, rol } },
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  };

  const logoutUser = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logout:", error);
    setPerfil(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        perfil,
        rol: perfil?.rol || null,
        loading,
        loginUser,
        signUpStaff,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
