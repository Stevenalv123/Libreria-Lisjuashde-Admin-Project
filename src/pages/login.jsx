import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authcontext";
import { toast } from "react-hot-toast";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState({});
    const [loading, setLoading] = useState(false);

    const { loginUser } = useAuth();
    const navigate = useNavigate();

    // --- Lógica de Login ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError({});
        try {
            const result = await loginUser(email, password);
            if (result.success) {
                const nombre = result.perfil?.nombre_completo || "";
                toast.success(`¡Bienvenido ${nombre} al panel de Librería Lisjuashde! 🎉`, {
                    style: {
                        backgroundColor: "rgb(34, 197, 94, 0.9)",
                        color: "#fff",
                        borderRadius: "12px",
                        padding: "12px 16px",
                    }
                });
                navigate("/dashboard");
            } else {
                if (result.error?.includes("Invalid login credentials")) {
                    setError({ field: "password", message: "Correo o contraseña incorrectos" });
                } else {
                    setError({ field: "general", message: result.error });
                }
            }
        } catch (err) {
            setError({ field: "general", message: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300"
            style={{ backgroundColor: 'var(--color-loginbg)' }}
        >
            <div className="flex flex-col items-center gap-6 w-full max-w-md">

                {/* Header / Logo */}
                <div className="flex flex-col items-center text-center gap-2 animate-fade-in-down">
                    <img src="/logo-libreria.png" alt="Logo Librería Lisjuashde" className="h-24 w-auto object-contain drop-shadow-lg" />
                    <div>
                        <h1 className="text-title text-3xl font-bold tracking-tight">Librería Lisjuashde</h1>
                        <p className="text-subtitle text-sm font-medium">Panel Administrativo · Materiales, Impresiones y Útiles</p>
                    </div>
                </div>

                {/* Tarjeta del Formulario */}
                <div className="bg-primary w-full p-8 rounded-3xl shadow-2xl border border-secondary transition-colors duration-300">

                    <div className="mb-6">
                        <h2 className="text-title text-2xl font-bold text-left">¡Hola de nuevo!</h2>
                        <p className="text-subtitle text-sm text-left mt-1">
                            Ingresa tus credenciales para acceder al panel.
                        </p>
                    </div>

                    <form className="flex flex-col gap-5" onSubmit={handleLogin}>

                        {/* Campo Email */}
                        <div className="space-y-1.5">
                            <label className="text-title text-sm font-semibold ml-1">Correo Electrónico</label>
                            <input
                                type="email"
                                required
                                placeholder="usuario@libreria.com"
                                className={`w-full bg-input text-title border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-subtitle/50 ${
                                    error?.field === "email" ? "border-red-500 ring-1 ring-red-500" : "border-secondary"
                                }`}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            {error?.field === "email" && <span className="text-red-500 text-xs ml-1">{error.message}</span>}
                        </div>

                        {/* Campo Password */}
                        <div className="space-y-1.5">
                            <label className="text-title text-sm font-semibold ml-1">Contraseña</label>
                            <input
                                type="password"
                                required
                                placeholder="••••••••"
                                className={`w-full bg-input text-title border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-subtitle/50 ${
                                    error?.field === "password" ? "border-red-500 ring-1 ring-red-500" : "border-secondary"
                                }`}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            {error?.field === "password" && <span className="text-red-500 text-xs ml-1">{error.message}</span>}
                        </div>

                        {/* Error General */}
                        {error?.field === "general" && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-sm text-center">
                                {error.message}
                            </div>
                        )}

                        {/* Botón Submit */}
                        <button
                            disabled={loading}
                            className="w-full cursor-pointer bg-button text-button font-bold py-3.5 rounded-xl shadow-lg hover:opacity-90 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Procesando...
                                </span>
                            ) : "Iniciar Sesión"}
                        </button>
                    </form>
                </div>

                {/* Footer pequeño */}
                <p className="text-subtitle text-xs opacity-60">
                    © {new Date().getFullYear()} Librería Lisjuashde. Todos los derechos reservados.
                </p>
            </div>
        </div>
    );
}
