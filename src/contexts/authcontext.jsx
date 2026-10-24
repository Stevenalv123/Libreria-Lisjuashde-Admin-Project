import { createContext, useEffect, useState, useContext, useRef } from "react";
import { supabase } from "../supabase/supabaseclient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(undefined);
  const [perfil, setPerfil] = useState(null);   // { rol, nombre_completo, ... }
  const [loading, setLoading] = useState(true);
  const perfilRef = useRef(null);

  const cargarPerfil = async (userId) => {
    if (!userId) { setPerfil(null); return null; }
    try {
      // Timeout de 5 segundos para que la app no quede colgada si Supabase no responde
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout_perfil")), 5000)
      );
      const queryPromise = supabase
        .from("perfiles")
        .select("id, nombre_completo, email, telefono, rol, id_empresa, id_sucursal, activo")
        .eq("id", userId)
        .single();
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
      if (error) {
        console.error("Error cargando perfil:", error.message);
        // Si falla un refresco, conservar el perfil previo del MISMO usuario (no elevar permisos)
        const previo = perfilRef.current;
        if (previo && previo.id === userId) return previo;
        setPerfil(null); return null;
      }
      perfilRef.current = data;
      setPerfil(data);
      return data;
    } catch (err) {
      console.error("Timeout o error al cargar perfil:", err.message);
      const previo = perfilRef.current;
      if (previo && previo.id === userId) return previo;
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
        // Evitar recargar el perfil en refrescos de token del mismo usuario
        if (perfilRef.current?.id !== session.user.id) {
          await cargarPerfil(session.user.id);
        }
      } else {
        perfilRef.current = null;
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
    // Verificar que el usuario sea STAFF. Los clientes NO entran aquí.
    // Roles con acceso al panel: superadmin, admin, gerente, cajero, despacho
    // (se mantiene "vendedor" por compatibilidad con datos existentes).
    const p = await cargarPerfil(data.user.id);
    const ROLES_STAFF = ["superadmin", "admin", "gerente", "cajero", "despacho", "vendedor"];
    if (!p || !ROLES_STAFF.includes(p.rol)) {
      // scope:'local' para no afectar sesiones de otras apps
      await supabase.auth.signOut({ scope: "local" });
      return { success: false, error: "Esta cuenta no tiene acceso al panel administrativo." };
    }
    // Bloquear cuentas desactivadas
    if (p.activo === false) {
      await supabase.auth.signOut({ scope: "local" });
      return { success: false, error: "Esta cuenta está desactivada. Contacte al administrador." };
    }
    return { success: true, data, perfil: p };
  };

  // Registro de nuevo miembro del staff (solo lo usará un admin desde Usuarios).
  // Nota: supabase.auth.signUp inicia sesión con el nuevo usuario en el navegador;
  // el módulo de Usuarios se encarga de restaurar la sesión del administrador.
  const signUpStaff = async (email, password, nombre_completo, rol = "admin", id_sucursal = null) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre_completo,
          rol,
          id_sucursal: id_sucursal != null ? String(id_sucursal) : "",
          id_empresa: "1",
        },
      },
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  };

  const logoutUser = async () => {
    // scope:'local' → solo cierra la sesión en ESTE navegador/app,
    // sin afectar otras apps abiertas (ej. la tienda cliente)
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) console.error("Error logout:", error);
    perfilRef.current = null;
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
