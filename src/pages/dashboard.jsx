import {
    User, LogOut, HardHat, ShoppingCart, UserCheck, Package,
    Users, Wallet, Wrench, FileSpreadsheetIcon, ChartColumn, TrendingUp,
    Bot, Sun, Moon, Lightbulb, Menu, X, ShoppingBag, Printer
} from "lucide-react";
import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authcontext";
import { useTheme } from "../contexts/themecontext";
import tippy from "tippy.js";
import BotComponent from "../components/bot";
import Swal from "sweetalert2";

// Cada enlace declara qué roles pueden verlo.
const ALL = ["admin", "vendedor", "cajero"];
const navLinks = [
    { to: "ventas", label: 'Ventas', icon: ShoppingCart, roles: ALL },
    { to: "pedidosWeb", label: 'Pedidos Web', icon: ShoppingBag, roles: ["admin", "vendedor"] },
    { to: "impresiones", label: 'Impresiones', icon: Printer, roles: ["admin", "vendedor"] },
    { to: "clientes", label: 'Clientes', icon: UserCheck, roles: ["admin", "vendedor"] },
    { to: "inventario", label: 'Inventario', icon: Package, roles: ["admin", "vendedor"] },
    { to: "proveedores", label: 'Proveedores', icon: Users, roles: ["admin"] },
    { to: "cajabancos", label: 'Cajas/Bancos', icon: Wallet, roles: ["admin", "cajero"] },
    { to: "activosFijos", label: 'Activos Fijos', icon: Wrench, roles: ["admin"] },
    { to: "gastosFijos", label: 'Gastos Fijos', icon: Lightbulb, roles: ["admin"] },
    { to: "personal", label: 'Personal', icon: HardHat, roles: ["admin"] },
    { to: "estadosFinancieros", label: 'Estados Financieros', icon: FileSpreadsheetIcon, roles: ["admin"] },
    { to: "analisis", label: 'Análisis', icon: ChartColumn, roles: ["admin"] },
    { to: "proyecciones", key: 'proyecciones', label: 'Proyecciones', icon: TrendingUp, roles: ["admin"] },
];

// Componente de enlace reutilizable
const AppLink = ({ to, icon: Icon, label, onClick }) => (
    <NavLink
        to={to}
        onClick={onClick}
        className={({ isActive }) =>
            `flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                ? "bg-button text-button"
                : "text-subtitle hover:bg-secondary/50 hover:text-title"
            }`
        }
    >
        <Icon size={18} />
        <span>{label}</span>
    </NavLink>
);

const ROL_LABEL = {
    admin: "Administrador",
    vendedor: "Vendedor",
    cajero: "Cajero",
};

export default function Dashboard() {
    const { session, perfil, rol, logoutUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showBot, setShowBot] = useState(false);

    // Filtra los enlaces según el rol del usuario autenticado.
    const visibleLinks = navLinks.filter(link => !rol || link.roles.includes(rol));

    tippy('#bot-button', { content: "Asistente IA", placement: 'left', theme: 'light' });

    const nombreUsuario = perfil?.nombre_completo || session?.user?.email || "Cargando...";
    const rolLabel = ROL_LABEL[rol] || "";

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: "¿Seguro que deseas salir?",
            text: "Tu sesión se cerrará y deberás iniciar sesión nuevamente.",
            icon: "warning",
            background: "#1e1e1e",
            color: "#fff",
            iconColor: "#facc15",
            showCancelButton: true,
            confirmButtonColor: "#2563eb",
            cancelButtonColor: "#ef4444",
            confirmButtonText: "Sí, cerrar sesión",
            cancelButtonText: "Cancelar",
            customClass: {
                popup: "rounded-2xl shadow-xl border border-gray-700",
                confirmButton: "rounded-lg px-4 py-2",
                cancelButton: "rounded-lg px-4 py-2",
            },
        });

        if (result.isConfirmed) {
            await logoutUser();

            await Swal.fire({
                title: "Sesión cerrada",
                text: "Has salido del sistema.",
                icon: "success",
                background: "#1e1e1e",
                color: "#fff",
                iconColor: "#22c55e",
                showConfirmButton: false,
                timer: 1400,
                customClass: {
                    popup: "rounded-2xl shadow-xl border border-gray-700",
                },
            });

            navigate("/login"); // ← ENVÍA DIRECTO A LOGIN
        }
    };

    return (
        <>
            <div className="bg-primary min-h-screen flex flex-col md:flex-row">

                {/* --- BARRA LATERAL (VISIBLE EN ESCRITORIO) --- */}
                <aside className="hidden md:flex md:flex-col w-64 bg-primary border-r border-secondary p-4 fixed top-0 left-0 h-screen overflow-y-auto">
                    <div className="flex items-center gap-3 mb-6">
                        <img src="/logo-libreria.png" alt="Logo" className="h-12 w-12 object-contain" />
                        <div className="flex flex-col">
                            <h3 className="text-title text-lg font-bold leading-tight">Librería Lisjuashde</h3>
                            <span className="text-subtitle text-sm">Panel Administrativo</span>
                        </div>
                    </div>
                    <nav className="flex-1 flex flex-col gap-2">
                        {visibleLinks.map((link, index) => (
                            <AppLink key={index} {...link} />
                        ))}

                    </nav>
                </aside>

                {/* --- CONTENIDO PRINCIPAL (HEADER MÓVIL + CONTENIDO) --- */}
                <div className="flex-1 flex flex-col md:ml-64">

                    {/* --- HEADER RESPONSIVO --- */}
                    <header className="flex flex-row bg-primary border-b-1 border-secondary p-3 justify-between items-center sticky top-0 z-10">

                        {/* Botón de Menú Hamburguesa (solo en móvil) */}
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="text-title p-1 md:hidden"
                        >
                            <Menu size={24} />
                        </button>

                        {/* Logo y Título (se oculta en móvil) */}
                        <div className="hidden md:flex">
                            <Link to="ventas" className="group cursor-pointer">
                                <img src="/logo-libreria.png" alt="Logo" className="h-14 mr-4 object-contain" />
                            </Link>
                            <div className="flex flex-col">
                                <Link to="ventas" className="group cursor-pointer">
                                    <h3 className="text-title text-2xl font-bold group-hover:text-button transition-colors">Librería Lisjuashde</h3>
                                    <span className="text-subtitle text-l">Panel Administrativo</span>
                                </Link>
                            </div>
                        </div>

                        {/* Título (solo en móvil, para centrarlo) */}
                        <span className="text-subtitle text-l md:hidden truncate">Librería Lisjuashde</span>

                        {/* Botones de Usuario (se adaptan) */}
                        <div className="flex gap-2 md:gap-4 items-center">
                            <div className="flex gap-2 items-center">
                                <User className="text-title" />
                                <div className="hidden md:flex flex-col leading-tight">
                                    <span className="text-subtitle text-sm">{nombreUsuario}</span>
                                    {rolLabel && <span className="text-subtitle/70 text-xs">{rolLabel}</span>}
                                </div>
                            </div>
                            <button onClick={toggleTheme} className="text-title flex gap-2 border-1 p-2 rounded-xl items-center justify-center cursor-pointer hover:bg-secondary transition-transform duration-200 ease-in-out hover:scale-110">
                                {theme === 'dark' ? <Sun color="white" /> : <Moon color="black" />}
                                <span className="hidden md:block">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                            </button>
                            <button onClick={handleLogout} className="text-title flex gap-2 border-1 p-2 rounded-xl items-center justify-center cursor-pointer hover:bg-secondary transition-transform duration-200 ease-in-out hover:scale-110">
                                <LogOut className="text-title" />
                                <span className="hidden md:block">Salir</span>
                            </button>
                        </div>
                    </header>

                    {/* --- CONTENIDO DE LA PÁGINA --- */}
                    <main className="w-[95%] mx-auto mt-4 flex flex-col gap-4 mb-20">
                        <Outlet />
                    </main>

                    {/* ... (tus elementos fixed: Bot, Modal de Bot, Footer) ... */}
                    <div className="fixed bottom-6 right-6 z-50">
                        <button id="bot-button" className="bg-button rounded-full w-16 h-16 flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform" onClick={() => setShowBot(true)}>
                            <Bot className="text-button w-8 h-8" />
                        </button>
                    </div>

                    {showBot && (
                        <div
                            // Móvil: Fondo oscuro, centrado
                            className="fixed inset-0 flex items-center justify-center bg-black/70 z-50 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none md:items-end md:justify-end"
                            onClick={() => setShowBot(false)}
                        >
                            <div
                                // Móvil: Centrado con margen | Desktop: Posición fija en la esquina
                                className="relative z-10 mx-4 md:mx-0 md:fixed md:bottom-28 md:right-8"
                                onClick={(e) => e.stopPropagation()} // Evita que el clic en el modal cierre el fondo
                            >
                                <BotComponent onClose={() => setShowBot(false)} />
                            </div>
                        </div>
                    )}

                    <footer className="fixed bottom-0 left-0 w-full border-t-1 border-secondary p-4 text-center text-subtitle bg-primary z-40">
                        &copy; {new Date().getFullYear()} Librería Lisjuashde. Todos los derechos reservados.
                    </footer>

                </div>

                {/* --- PANEL DE MENÚ MÓVIL (SOBREPUESTO) --- */}
                {isMobileMenuOpen && (
                    <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="fixed top-0 left-0 h-full w-64 bg-primary p-4 shadow-lg z-50" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-2">
                                    <img src="/logo-libreria.png" alt="Logo" className="h-9 w-9 object-contain" />
                                    <span className="text-title font-bold text-base leading-tight">Librería Lisjuashde</span>
                                </div>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="text-title p-1"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <nav className="flex-1 flex flex-col gap-2">
                                {visibleLinks.map((link, index) => (
                                    <AppLink
                                        key={index}
                                        {...link}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    />
                                ))}
                            </nav>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}