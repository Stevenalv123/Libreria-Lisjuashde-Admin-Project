import { createContext, useEffect, useState, useContext } from "react";
import { supabase } from "../supabase/supabaseclient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(null);   // { rol, nombre_completo, ... }
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (userId) => {
    if (!userId) { setPerfil(null); return null; }
    try {
      // Timeout de 5 segundos para que la app no quede colgada si Supabase no responde
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout_perfil")), 5000)
      );
      const queryPromise = supabase
        .from("perfiles")
        .select("id, nombre_completo, email, telefono, rol, id_empresa")
        .eq("id", userId)
        .single();
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      if (error) { console.error("Error cargando perfil:", error.message); setPerfil(null); return null; }
      setPerfil(data);
      return data;
    } catch (err) {
      console.error("Timeout o error al cargar perfil:", err.message);
      setPerfil(null);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Inicialización: obtener sesión actual con try/finally para que loading siempre baje
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);
        if (session?.user) await cargarPerfil(session.user.id);
      } catch (err) {
        console.error("Error inicializando auth:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      if (session?.user) {
        await cargarPerfil(session.user.id);
      } else {
        setPerfil(null);
      }
      // Garantizar que loading baje si onAuthStateChange dispara antes que initAuth termine
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
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
      // scope:'local' para no afectar sesiones de otras apps
      await supabase.auth.signOut({ scope: "local" });
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
    // scope:'local' → solo cierra la sesión en ESTE navegador/app,
    // sin afectar otras apps abiertas (ej. la tienda cliente)
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Error logout:", error);
    setSession(null);
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
