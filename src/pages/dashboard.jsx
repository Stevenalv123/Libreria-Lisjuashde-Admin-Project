import {
    LogOut, HardHat, ShoppingCart, UserCheck, Package,
    Users, Wallet, Wrench, FileSpreadsheetIcon, ChartColumn, TrendingUp,
    Sun, Moon, Lightbulb, Menu, X, ShoppingBag, Printer,
    Building2, Monitor, DoorOpen, RotateCcw, ScrollText, ArrowLeftRight,
    Megaphone, BarChart3
} from "lucide-react";
import { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/authcontext";
import { useTheme } from "../contexts/themecontext";
import Swal from "sweetalert2";

// Navegación agrupada por secciones. Cada enlace declara qué roles pueden verlo.
// Roles del sistema: superadmin (ve TODO), admin, gerente, cajero, despacho.
// (Se mantiene "vendedor" por compatibilidad con datos existentes → equiparado a admin.)
const navGroups = [
    {
        section: "Ventas y Atención",
        links: [
            { to: "ventas",         label: 'Ventas',               icon: ShoppingCart, roles: ["admin", "vendedor", "gerente", "cajero"] },
            { to: "pedidosWeb",     label: 'Pedidos Web',           icon: ShoppingBag,  roles: ["admin", "vendedor", "despacho"] },
            { to: "impresiones",    label: 'Impresiones',           icon: Printer,      roles: ["admin", "vendedor", "cajero", "despacho"] },
            { to: "clientes",       label: 'Clientes',              icon: UserCheck,    roles: ["admin", "vendedor"] },
            { to: "devoluciones",   label: 'Devoluciones',          icon: RotateCcw,    roles: ["admin", "vendedor", "cajero"] },
            { to: "aperturaCierre", label: 'Apertura/Cierre Caja',  icon: DoorOpen,     roles: ["cajero", "admin", "gerente"] },
        ],
    },
    {
        section: "Inventario",
        links: [
            { to: "inventario",     label: 'Inventario',     icon: Package,        roles: ["admin", "vendedor"] },
            { to: "proveedores",    label: 'Proveedores',    icon: Users,          roles: ["admin", "vendedor"] },
            { to: "transferencias", label: 'Transferencias', icon: ArrowLeftRight, roles: ["admin", "vendedor"] },
            { to: "sucursales",     label: 'Sucursales',     icon: Building2,      roles: ["admin", "vendedor"] },
        ],
    },
    {
        section: "Finanzas",
        links: [
            { to: "cajabancos",         label: 'Cajas/Bancos',       icon: Wallet,              roles: ["admin", "vendedor"] },
            { to: "activosFijos",       label: 'Activos Fijos',      icon: Wrench,              roles: ["admin", "vendedor"] },
            { to: "gastosFijos",        label: 'Gastos Fijos',       icon: Lightbulb,           roles: ["admin", "vendedor"] },
            { to: "estadosFinancieros", label: 'Estados Financieros', icon: FileSpreadsheetIcon, roles: ["admin", "vendedor", "gerente"] },
            { to: "analisis",           label: 'Análisis',           icon: ChartColumn,         roles: ["admin", "vendedor", "gerente"] },
            { to: "proyecciones",       label: 'Proyecciones',       icon: TrendingUp,          roles: ["admin", "vendedor", "gerente"] },
        ],
    },
    {
        section: "Recursos Humanos",
        links: [
            { to: "recursosHumanos", label: 'Recursos Humanos', icon: HardHat, roles: ["admin", "vendedor", "gerente"] },
        ],
    },
    {
        section: "Marketing",
        links: [
            { to: "marketing", label: 'Marketing', icon: Megaphone, roles: ["admin", "vendedor", "gerente"] },
        ],
    },
    {
        section: "Reportes",
        links: [
            { to: "reportes", label: 'Reportes y Análisis', icon: BarChart3, roles: ["admin", "vendedor", "gerente"] },
        ],
    },
    {
        section: "Sistema",
        links: [
            { to: "terminalesPOS", label: 'Terminales POS',      icon: Monitor,    roles: [] }, // solo superadmin
            { to: "usuarios",      label: 'Usuarios y Permisos', icon: Users,      roles: [] }, // solo superadmin
            { to: "auditoria",     label: 'Auditoría',           icon: ScrollText, roles: [] }, // solo superadmin
        ],
    },
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
    superadmin: "Super Administrador",
    admin: "Administrador",
    gerente: "Gerente",
    cajero: "Cajero",
    despacho: "Despacho",
    vendedor: "Vendedor",
};

// Obtiene las iniciales (máx. 2) del nombre del usuario.
const obtenerIniciales = (nombre) => {
    if (!nombre) return "?";
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    if (partes.length === 0) return "?";
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
};

// Filtra un grupo de enlaces según el rol.
const filtrarGrupos = (rol) =>
    navGroups
        .map((grupo) => ({
            ...grupo,
            links: rol === "superadmin"
                ? grupo.links
                : grupo.links.filter((link) => !!rol && link.roles.includes(rol)),
        }))
        .filter((grupo) => grupo.links.length > 0);

// Renderiza la navegación agrupada con encabezados de sección.
const NavSecciones = ({ grupos, onLinkClick }) => (
    <nav className="flex-1 flex flex-col gap-1">
        {grupos.map((grupo) => (
            <div key={grupo.section} className="flex flex-col gap-1">
                <p className="text-xs text-subtitle/50 font-semibold uppercase tracking-wider px-3 mt-4 mb-1">
                    {grupo.section}
                </p>
                {grupo.links.map((link) => (
                    <AppLink key={link.to} {...link} onClick={onLinkClick} />
                ))}
            </div>
        ))}
    </nav>
);

export default function Dashboard() {
    const { session, perfil, rol, logoutUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [ahora, setAhora] = useState(new Date());

    // Reloj en vivo del header (actualiza cada minuto).
    useEffect(() => {
        const timer = setInterval(() => setAhora(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    const gruposVisibles = filtrarGrupos(rol);

    const nombreUsuario = perfil?.nombre_completo || session?.user?.email || "Cargando...";
    const rolLabel = ROL_LABEL[rol] || "";
    const iniciales = obtenerIniciales(perfil?.nombre_completo || session?.user?.email);

    const fechaTexto = ahora.toLocaleDateString("es-NI", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    const horaTexto = ahora.toLocaleTimeString("es-NI", { hour: "2-digit", minute: "2-digit" });

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

            navigate("/login");
        }
    };

    return (
        <>
            <div className="bg-primary min-h-screen flex flex-col md:flex-row">

                {/* --- BARRA LATERAL (VISIBLE EN ESCRITORIO) --- */}
                <aside className="hidden md:flex md:flex-col w-64 bg-primary border-r border-secondary p-4 fixed top-0 left-0 h-screen overflow-y-auto">
                    <div className="flex items-center gap-3 mb-4">
                        <img src="/logo-libreria.png" alt="Logo" className="h-12 w-12 object-contain" />
                        <div className="flex flex-col">
                            <h3 className="text-title text-lg font-bold leading-tight">Librería Lisjuashde</h3>
                            <span className="text-subtitle text-sm">Panel Administrativo</span>
                        </div>
                    </div>

                    {/* Tarjeta de usuario en el sidebar */}
                    <div className="flex items-center gap-3 bg-secondary/40 border border-secondary rounded-xl p-3 mb-2">
                        <div className="h-10 w-10 rounded-full bg-button text-button flex items-center justify-center font-bold text-sm shrink-0">
                            {iniciales}
                        </div>
                        <div className="flex flex-col leading-tight overflow-hidden">
                            <span className="text-title text-sm font-semibold truncate">{nombreUsuario}</span>
                            {rolLabel && <span className="text-subtitle/70 text-xs">{rolLabel}</span>}
                        </div>
                    </div>

                    <NavSecciones grupos={gruposVisibles} />
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

                        {/* Fecha y hora (escritorio) */}
                        <div className="hidden md:flex flex-col leading-tight">
                            <span className="text-title text-sm font-semibold capitalize">{fechaTexto}</span>
                            <span className="text-subtitle text-xs">{horaTexto}</span>
                        </div>

                        {/* Título (solo en móvil, para centrarlo) */}
                        <span className="text-subtitle text-l md:hidden truncate">Librería Lisjuashde</span>

                        {/* Botones de Usuario (se adaptan) */}
                        <div className="flex gap-2 md:gap-4 items-center">
                            <div className="flex gap-2 items-center">
                                <div className="h-9 w-9 rounded-full bg-button text-button flex items-center justify-center font-bold text-xs shrink-0">
                                    {iniciales}
                                </div>
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

                    <footer className="fixed bottom-0 left-0 w-full border-t-1 border-secondary p-4 text-center text-subtitle bg-primary z-40">
                        &copy; {new Date().getFullYear()} Librería Lisjuashde. Todos los derechos reservados.
                    </footer>

                </div>

                {/* --- PANEL DE MENÚ MÓVIL (SOBREPUESTO) --- */}
                {isMobileMenuOpen && (
                    <div className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
                        <div className="fixed top-0 left-0 h-full w-64 bg-primary p-4 shadow-lg z-50 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-4">
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

                            {/* Tarjeta de usuario (móvil) */}
                            <div className="flex items-center gap-3 bg-secondary/40 border border-secondary rounded-xl p-3 mb-2">
                                <div className="h-10 w-10 rounded-full bg-button text-button flex items-center justify-center font-bold text-sm shrink-0">
                                    {iniciales}
                                </div>
                                <div className="flex flex-col leading-tight overflow-hidden">
                                    <span className="text-title text-sm font-semibold truncate">{nombreUsuario}</span>
                                    {rolLabel && <span className="text-subtitle/70 text-xs">{rolLabel}</span>}
                                </div>
                            </div>

                            <NavSecciones grupos={gruposVisibles} onLinkClick={() => setIsMobileMenuOpen(false)} />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
