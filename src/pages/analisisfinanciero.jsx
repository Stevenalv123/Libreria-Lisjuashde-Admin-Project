import {
    CircleCheckBig, DollarSign, Percent, TrendingUp, Activity,
    AlertTriangle, TrendingDown, Info, Zap, Package, UserCheck, Repeat, Building, Wallet
} from "lucide-react";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { useMemo, useState, useCallback, useEffect } from "react";
// import { useCuentas } from "../hooks/useCuentas"; // <-- Ya no se usa
import { useEmpresa } from "../contexts/empresacontext";
import { supabase } from "../supabase/supabaseclient";
import { toast } from "react-hot-toast";
import usePersistentState from "../hooks/usePersistentState"; // <-- Nombre corregido

// --- PARÁMETROS DE LA INDUSTRIA (Basado en tu Formulario) ---
const INDUSTRY_AVERAGES = {
    liquidezCorriente: 1.75, // Promedio de 1.5 - 2
    razonRapida: 1.0,
    rotacionInventarios: 7.5, // Promedio de 5 - 10
    periodoInventarios: 48, // 360 / 7.5
    rotacionCxC: 8.5, // Promedio de 5 - 12
    periodoCxC: 42, // 360 / 8.5
    rotacionActivosFijos: 6.5, // Promedio de 5 - 8
    rotacionActivosTotales: 1.9, // Promedio de 1 - 2.5
    endeudamiento: 0.4, // Promedio de 0.3 - 0.5 (40%)
    razonPasivoCapital: 0.75, // Promedio de 0.5 - 1
    margenBruto: 30.0, // (en %) Promedio de 20 - 40
    margenOperativo: 15.0, // (en %) Promedio de 10 - 20
    margenNeto: 7.5, // (en %) Promedio de 5 - 10
    roa: 7.5, // (en %) Promedio de 5 - 10
    roe: 15.0, // (Promedio no dado, asumiendo 15%)
};

// --- Colores para Gráfico ---
const PIE_COLORS = ["#0088FE", "#FF8042", "#00C49F"];

// --- Función para obtener fechas ---
const getTodayString = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
}

// --- Helper para encontrar saldos en los datos (sensible a mayúsculas/minúsculas) ---
const findSaldo = (cuentas, nombres) => {
    const nombresLower = nombres.map(n => n.toLowerCase());
    let total = 0;
    cuentas.forEach(cuenta => {
        // 'cuenta.cuenta' viene de la vista 'balance_general_view'
        if (nombresLower.includes(cuenta.cuenta?.toLowerCase())) {
            total += cuenta.saldo;
        }
    });
    return total;
};

export default function AnalisisFinanciero() {
    // --- 1. ESTADOS PARA LOS DATOS Y FECHAS (Igual que en EstadosFinancieros) ---
    const [cuentasActuales, setCuentasActuales] = useState([]);
    const [cuentasAnteriores, setCuentasAnteriores] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const { empresaId } = useEmpresa();
    const [empresaInfo, setEmpresaInfo] = useState(null);
    const [fechaInicio, setFechaInicio] = usePersistentState('finance_erp_fecha_inicio', getTodayString());
    const [fechaCierre, setFechaCierre] = usePersistentState('finance_erp_fecha_cierre', getTodayString());

    useEffect(() => {
        const fetchEmpresaInfo = async () => {
            if (!empresaId) return;
            try {
                const { data, error } = await supabase
                    .from('empresa')
                    .select(`
                        nombre, 
                        id_moneda, 
                        moneda:moneda(id_moneda, nombre, simbolo)
                    `)
                    .eq('id_empresa', empresaId)
                    .single();

                if (error) throw error;
                setEmpresaInfo(data);
            } catch (err) {
                toast.error("No se pudo cargar la información de la empresa.");
                console.error(err);
            }
        };

        fetchEmpresaInfo();
    }, [empresaId]);

    // --- 2. LÓGICA DE CARGA DE DATOS (Igual que en EstadosFinancieros) ---
    const handleGenerarReporte = useCallback(async (showAlerts = false) => {
        if (!fechaInicio || !fechaCierre) {
            if (showAlerts) toast.error("Seleccione fecha de inicio y cierre");
            return;
        }
        if (!empresaId) return;
        setIsLoading(true);
        let fechaAnterior = new Date(fechaInicio);
        fechaAnterior.setDate(fechaAnterior.getDate() - 1);
        const fechaInicioReporte = fechaAnterior.toISOString().split('T')[0];

        try {
            // Carga info de la empresa
            const { data: infoEmpresa, error: errorInfo } = await supabase
                .from('empresa')
                .select(`nombre, moneda ( simbolo )`)
                .eq('id_empresa', empresaId)
                .single();
            if (errorInfo) throw errorInfo;
            setEmpresaInfo(infoEmpresa);

            // Carga datos del balance anterior
            const { data: dataAnterior, error: errorAnterior } = await supabase.rpc('sp_get_balance_as_of_date', {
                p_id_empresa: empresaId, p_fecha_corte: fechaInicioReporte
            });
            if (errorAnterior) throw errorAnterior;
            setCuentasAnteriores(dataAnterior || []);

            // Carga datos del balance actual
            const { data: dataActual, error: errorActual } = await supabase.rpc('sp_get_balance_as_of_date', {
                p_id_empresa: empresaId, p_fecha_corte: fechaCierre
            });
            if (errorActual) throw errorActual;
            setCuentasActuales(dataActual || []);
        } catch (error) {
            toast.error(`Error al generar reportes: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [empresaId, fechaInicio, fechaCierre]);

    useEffect(() => {
        handleGenerarReporte();
    }, [handleGenerarReporte]);

    // --- 3. BLOQUE DE CÁLCULO GIGANTE ---
    const {
        // Ratios
        liquidezCorriente, razonRapida,
        rotacionInventarios, periodoInventarios, rotacionCxC, periodoCxC,
        rotacionActivosFijos, rotacionActivosTotales,
        endeudamiento, razonPasivoCapital,
        margenBruto, margenOperativo, margenNeto, roa, roe,
        // DuPont
        dupontMargenNeto, dupontRotacionActivos, dupontApalancamiento,
        // Capital de Trabajo
        cnt, cno,
        // Interpretaciones
        liquidezScore, endeudamientoScore, rentabilidadScore,
        generalScore, generalStatus,
        liquidezInterpretation, endeudamientoInterpretation, rentabilidadInterpretation,
        // Datos de Gráficos
        pieChartData, barChartData,
    } = useMemo(() => {

        // --- Función Interna de Cálculo ---
        const calcularRatios = (cuentas) => {
            const activos = cuentas.filter(c => c.tipo === 'Activo');
            const pasivos = cuentas.filter(c => c.tipo === 'Pasivo');
            const patrimonioCuentas = cuentas.filter(c => c.tipo === 'Patrimonio');
            const ingresos = cuentas.filter(c => c.tipo === 'Ingreso');
            const costos = cuentas.filter(c => c.tipo === 'Costo');
            const gastos = cuentas.filter(c => c.tipo === 'Gasto');

            // P&L (Saldos YTD)
            const totalVentas = Math.abs(findSaldo(ingresos, ["Ventas"]));
            const totalCostosVenta = findSaldo(costos, ["Costo de Venta"]);
            const utilidadBruta = totalVentas - totalCostosVenta;
            const totalGastosOp = findSaldo(gastos, ["Gasto por Depreciación", "Otros Gastos"]);
            const utilidadOperativa = utilidadBruta - totalGastosOp;
            const impuestoIR = utilidadOperativa > 0 ? utilidadOperativa * 0.3 : 0;
            const utilidadNeta = utilidadOperativa - impuestoIR;

            // Balance
            const totalActivoCorriente = activos
                .filter(c => c.subtipo && c.subtipo.includes('Corriente') && !c.subtipo.includes('No'))
                .reduce((sum, c) => sum + c.saldo, 0);
            const totalActivoNoCorriente = activos
                .filter(c => c.subtipo && (c.subtipo.includes('No Corriente') || c.subtipo.includes('Fijo')))
                .reduce((sum, c) => sum + c.saldo, 0);
            const totalActivos = totalActivoCorriente + totalActivoNoCorriente;

            const totalPasivoCorriente = Math.abs(pasivos
                .filter(c => c.subtipo && c.subtipo.includes('Corriente') && !c.subtipo.includes('No'))
                .reduce((sum, c) => sum + c.saldo, 0));
            const totalPasivoNoCorriente = Math.abs(pasivos
                .filter(c => c.subtipo && (c.subtipo.includes('No Corriente') || c.subtipo.includes('Largo')))
                .reduce((sum, c) => sum + c.saldo, 0));
            const totalPasivos = totalPasivoCorriente + totalPasivoNoCorriente;

            const totalPatrimonioCuentas = Math.abs(patrimonioCuentas.reduce((sum, c) => sum + c.saldo, 0));
            // La Utilidad Neta del balance ya está incluida en la BBDD
            const utilidadNetaBalance = findSaldo(patrimonioCuentas, ["Utilidad (o Pérdida) del Período"]) || utilidadNeta;
            const totalPatrimonio = totalPatrimonioCuentas; // El totalPatrimonioCuentas ya incluye la utilidad

            // Cuentas Específicas
            const inventario = findSaldo(activos, ["Inventario"]);
            const cxc = findSaldo(activos, ["Clientes"]);
            const cxcProveedores = Math.abs(findSaldo(pasivos, ["Proveedores"]));
            const activosFijosNetos = totalActivoNoCorriente;

            return {
                totalVentas, totalCostosVenta, utilidadBruta, utilidadOperativa, utilidadNeta,
                totalActivoCorriente, totalActivos, totalPasivoCorriente, totalPasivos, totalPatrimonio,
                inventario, cxc, cxcProveedores, activosFijosNetos
            };
        };
        // --- Fin de la Función Interna ---

        // --- Calcular Ratios para ambos períodos ---
        const actualYTD = calcularRatios(cuentasActuales);
        const anteriorYTD = calcularRatios(cuentasAnteriores);

        // --- Calcular P&L del PERÍODO (Actual YTD - Anterior YTD) ---
        const periodoVentas = actualYTD.totalVentas - anteriorYTD.totalVentas;
        const periodoCostosVenta = actualYTD.totalCostosVenta - anteriorYTD.totalCostosVenta;
        const periodoUtilidadBruta = actualYTD.utilidadBruta - anteriorYTD.utilidadBruta;
        const periodoUtilidadOperativa = actualYTD.utilidadOperativa - anteriorYTD.utilidadOperativa;
        const periodoUtilidadNeta = actualYTD.utilidadNeta - anteriorYTD.utilidadNeta;

        // --- PROMEDIOS para ratios de actividad ---
        const calcPromedio = (actual, anterior) => {
            if (anterior === 0) return actual;
            return (actual + anterior) / 2;
        };

        const inventarioPromedio = calcPromedio(actualYTD.inventario, anteriorYTD.inventario);
        const cxcPromedio = calcPromedio(actualYTD.cxc, anteriorYTD.cxc);
        const activosFijosPromedio = calcPromedio(actualYTD.activosFijosNetos, anteriorYTD.activosFijosNetos);
        const activosTotalesPromedio = calcPromedio(actualYTD.totalActivos, anteriorYTD.totalActivos);

        // --- CÁLCULO DE TODOS LOS RATIOS (Usando Balances 'actualYTD' y P&L 'periodo') ---
        const d = (den) => (den === 0 ? 0 : den); // Evitar división por cero

        // 1. Liquidez (usa Balance actual)
        const liquidezCorriente = actualYTD.totalActivoCorriente / d(actualYTD.totalPasivoCorriente);
        const razonRapida = (actualYTD.totalActivoCorriente - actualYTD.inventario) / d(actualYTD.totalPasivoCorriente);
        // 2. Capital de Trabajo
        const cnt = actualYTD.totalActivoCorriente - actualYTD.totalPasivoCorriente;
        const cno = (actualYTD.cxc + actualYTD.inventario) - actualYTD.cxcProveedores;
        // 3. Actividad (usa P&L del periodo / Balances promedio)
        const rotacionInventarios = periodoCostosVenta / d(inventarioPromedio);
        const periodoInventarios = 360 / d(rotacionInventarios);
        const rotacionCxC = periodoVentas / d(cxcPromedio);
        const periodoCxC = 360 / d(rotacionCxC);
        const rotacionActivosFijos = periodoVentas / d(activosFijosPromedio);
        const rotacionActivosTotales = periodoVentas / d(activosTotalesPromedio);
        // 4. Endeudamiento (usa Balance actual)
        const endeudamiento = actualYTD.totalPasivos / d(actualYTD.totalActivos);
        const razonPasivoCapital = actualYTD.totalPasivos / d(actualYTD.totalPatrimonio);
        // 5. Rentabilidad (usa P&L del periodo)
        const margenBruto = (periodoUtilidadBruta / d(periodoVentas)) * 100;
        const margenOperativo = (periodoUtilidadOperativa / d(periodoVentas)) * 100;
        const margenNeto = (periodoUtilidadNeta / d(periodoVentas)) * 100;
        const roa = (periodoUtilidadNeta / d(actualYTD.totalActivos)) * 100;
        const roe = (periodoUtilidadNeta / d(actualYTD.totalPatrimonio)) * 100;
        // 6. DuPont (usa P&L del periodo y Balance actual)
        const dupontMargenNeto = margenNeto;
        const dupontRotacionActivos = periodoVentas / d(actualYTD.totalActivos);
        const dupontApalancamiento = actualYTD.totalActivos / d(actualYTD.totalPatrimonio);

        // --- LÓGICA DE PUNTUACIÓN E INTERPRETACIÓN ---
        const score = (valor, optimo) => Math.max(0, 100 - (Math.abs(valor - optimo) / optimo) * 100);
        const liquidezScore = score(liquidezCorriente, INDUSTRY_AVERAGES.liquidezCorriente);
        const endeudamientoScore = score(endeudamiento, INDUSTRY_AVERAGES.endeudamiento);
        const rentabilidadScore = score(roe, INDUSTRY_AVERAGES.roe);
        const generalScore = (liquidezScore + endeudamientoScore + rentabilidadScore) / 3;

        const getStatus = (score) => {
            if (score > 90) return "Excelente";
            if (score > 75) return "Saludable";
            if (score > 50) return "Aceptable";
            return "Riesgo";
        };
        const generalStatus = getStatus(generalScore);
        const liquidezStatus = getStatus(liquidezScore);
        const endeudamientoStatus = getStatus(endeudamientoScore);
        const rentabilidadStatus = getStatus(rentabilidadScore);

        const liquidezInterpretation = `Ratio Corriente: ${liquidezCorriente.toFixed(2)} (vs Ind. ${INDUSTRY_AVERAGES.liquidezCorriente}). Rápida: ${razonRapida.toFixed(2)} (vs Ind. ${INDUSTRY_AVERAGES.razonRapida}).`;
        const endeudamientoInterpretation = `Nivel Endeudamiento: ${endeudamiento.toFixed(1)}% (vs Ind. ${INDUSTRY_AVERAGES.endeudamiento * 100}%)`;
        const rentabilidadInterpretation = `ROE: ${roe.toFixed(1)}% (vs Ind. ${INDUSTRY_AVERAGES.roe.toFixed(1)}%). Margen Neto: ${margenNeto.toFixed(1)}% (vs Ind. ${INDUSTRY_AVERAGES.margenNeto.toFixed(1)}%).`;

        // --- Datos para Gráficos ---
        const pieChartData = [
            { name: "Liquidez", value: liquidezScore },
            { name: "Endeudamiento", value: endeudamientoScore },
            { name: "Rentabilidad", value: rentabilidadScore },
        ];
        const barChartData = [
            { name: "Liquidez C.", "Tu Empresa": parseFloat(liquidezCorriente.toFixed(2)), Industria: INDUSTRY_AVERAGES.liquidezCorriente },
            { name: "Rápida", "Tu Empresa": parseFloat(razonRapida.toFixed(2)), Industria: INDUSTRY_AVERAGES.razonRapida },
            { name: "Endeudamiento", "Tu Empresa": parseFloat(endeudamiento.toFixed(1)) * 100, Industria: INDUSTRY_AVERAGES.endeudamiento * 100 },
            { name: "Margen Neto", "Tu Empresa": parseFloat(margenNeto.toFixed(1)), Industria: INDUSTRY_AVERAGES.margenNeto },
            { name: "ROE", "Tu Empresa": parseFloat(roe.toFixed(1)), Industria: INDUSTRY_AVERAGES.roe },
            { name: "ROA", "Tu Empresa": parseFloat(roa.toFixed(1)), Industria: INDUSTRY_AVERAGES.roa },
        ];

        return {
            liquidezCorriente, razonRapida, rotacionInventarios, periodoInventarios, rotacionCxC, periodoCxC,
            rotacionActivosFijos, rotacionActivosTotales, endeudamiento, razonPasivoCapital,
            margenBruto, margenOperativo, margenNeto, roa, roe,
            dupontMargenNeto, dupontRotacionActivos, dupontApalancamiento,
            cnt, cno,
            liquidezScore, endeudamientoScore, rentabilidadScore,
            generalScore, generalStatus,
            liquidezStatus, liquidezInterpretation, endeudamientoStatus, endeudamientoInterpretation,
            rentabilidadStatus, rentabilidadInterpretation,
            pieChartData, barChartData,
        };
    }, [cuentasActuales, cuentasAnteriores]);

    // Helper para íconos
    const StatusIcon = ({ score }) =>
        score > 50 ? <CircleCheckBig className="inline mr-2 text-green-600" /> : <AlertTriangle className="inline mr-2 text-yellow-500" />;

    // --- 4. VALIDACIÓN DE DATOS ANTES DE RENDERIZAR ---
    if (isLoading) {
        return (
            <div className="p-6">
                <div className="p-6 border border-secondary rounded-xl bg-secondary/10 text-center">
                    <Info className="mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">Cargando Reportes...</h2>
                </div>
            </div>
        );
    }

    if (cuentasActuales.length === 0 && !isLoading) {
        return (
            <div className="p-6">
                <div className="p-6 border border-secondary rounded-xl bg-secondary/10 text-center">
                    <Info className="mx-auto mb-4" />
                    <h2 className="text-xl font-semibold mb-2">No hay datos para analizar</h2>
                    <p className="text-subtitle">
                        Por favor, ve a la pestaña "Estados Financieros", selecciona un rango
                        de fechas y presiona "Generar" para ver el análisis.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="p-6">
                <h1 className="text-2xl font-bold mb-1">Análisis Financiero</h1>
                <p className="text-subtitle">
                    Empresa: {empresaInfo ? empresaInfo.nombre : 'Cargando...'} | Moneda: {empresaInfo ? empresaInfo.moneda.simbolo : 'N/A'}
                </p>
            </div>

            {/* --- BLOQUE DE DIAGNÓSTICO --- */}
            <div className="p-6 border border-secondary rounded-xl bg-secondary/10">
                <div>
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
                        <Zap />
                        Diagnóstico Financiero General
                    </h2>
                    <p className="text-subtitle">Evaluación de salud financiera</p>
                </div>
                <div className="flex flex-row justify-between mt-6">
                    <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">Puntuación General:</h2>
                    <div className="flex flex-row items-center gap-4">
                        <progress className="w-32 h-1 rounded-full bg-secondary/30 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-secondary/30 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-white [&::-moz-progress-bar]:bg-white" value={generalScore} max="100"></progress>
                        <div className="text-right text-sm font-semibold rounded-2xl bg-title">
                            <span className="px-3 py-1 text-button bg-button rounded-2xl">{generalStatus}</span>
                        </div>
                    </div>
                </div>
                <div className="mt-4 flex flex-col md:flex-row space-between gap-4">
                    <div className="border border-secondary p-4 rounded-2xl w-full">
                        <div>
                            <StatusIcon score={liquidezScore} />
                            <span className="font-semibold text-title">Liquidez</span>
                        </div>
                        <p className="text-subtitle mt-2 text-xs">{liquidezInterpretation}</p>
                        <progress className="w-full h-1 mt-2 rounded-full bg-secondary/30 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-secondary/30 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-white [&::-moz-progress-bar]:bg-white" value={liquidezScore} max="100"></progress>
                    </div>
                    <div className="border border-secondary p-4 rounded-2xl w-full">
                        <div>
                            <StatusIcon score={endeudamientoScore} />
                            <span className="font-semibold text-title">Endeudamiento</span>
                        </div>
                        <p className="text-subtitle mt-2 text-xs">{endeudamientoInterpretation}</p>
                        <progress className="w-full h-1 mt-2 rounded-full bg-secondary/30 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-secondary/30 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-white [&::-moz-progress-bar]:bg-white" value={endeudamientoScore} max="100"></progress>
                    </div>
                    <div className="border border-secondary p-4 rounded-2xl w-full">
                        <div>
                            <StatusIcon score={rentabilidadScore} />
                            <span className="font-semibold text-title">Rentabilidad</span>
                        </div>
                        <p className="text-subtitle mt-2 text-xs">{rentabilidadInterpretation}</p>
                        <progress className="w-full h-1 mt-2 rounded-full bg-secondary/30 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-secondary/30 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-white [&::-moz-progress-bar]:bg-white" value={rentabilidadScore} max="100"></progress>
                    </div>
                </div>
            </div>

            {/* --- BLOQUE DE RATIOS CLAVE --- */}
            <div className="p-6 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><DollarSign className="inline mr-2" color="blue" /><span className="font-semibold text-title">Liquidez Corriente</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{liquidezCorriente.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">{liquidezCorriente}</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><TrendingDown className="inline mr-2" color="orange" /><span className="font-semibold text-title">Razón Rápida</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{razonRapida.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">{razonRapida > 1 ? "Saludable" : "Riesgo"}</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><Wallet className="inline mr-2" color="teal" /><span className="font-semibold text-title">Capital Neto Trabajo</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">C$ {cnt.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">{cnt > 0 ? "Positivo" : "Negativo"}</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><Building className="inline mr-2" color="gray" /><span className="font-semibold text-title">Capital Neto Operativo</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">C$ {cno.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">{cno > 0 ? "Requiere Inversión" : "Genera Efectivo"}</p>
                </div>
            </div>

            <div className="p-6 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><Package className="inline mr-2" color="brown" /><span className="font-semibold text-title">Rotación Inventario</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{rotacionInventarios.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">Veces al año</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><UserCheck className="inline mr-2" color="cyan" /><span className="font-semibold text-title">Rotación CxC</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{rotacionCxC.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">Veces al año</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><Repeat className="inline mr-2" color="pink" /><span className="font-semibold text-title">Rotación Activos Fijos</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{rotacionActivosFijos.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">Veces al año</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><Activity className="inline mr-2" color="purple" /><span className="font-semibold text-title">Rotación Activos Totales</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{rotacionActivosTotales.toFixed(2)}</p>
                    <p className="text-subtitle mt-2">Veces al año</p>
                </div>
            </div>

            <div className="p-6 mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><Percent className="inline mr-2" color="red" /><span className="font-semibold text-title">Endeudamiento</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{(endeudamiento * 100).toFixed(1)}%</p>
                    <p className="text-subtitle mt-2">{endeudamientoScore}</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><TrendingUp className="inline mr-2" color="green" /><span className="font-semibold text-title">Margen Bruto</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{margenBruto.toFixed(1)}%</p>
                    <p className="text-subtitle mt-2">Rentabilidad de Ventas</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><TrendingUp className="inline mr-2" color="green" /><span className="font-semibold text-title">Margen Neto</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{margenNeto.toFixed(1)}%</p>
                    <p className="text-subtitle mt-2">{rentabilidadScore}</p>
                </div>
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <div><Activity className="inline mr-2" color="purple" /><span className="font-semibold text-title">ROE</span></div>
                    <p className="text-title text-2xl font-semibold mt-6 ">{roe.toFixed(1)}%</p>
                    <p className="text-subtitle mt-2">Retorno sobre Patrimonio</p>
                </div>
            </div>

            {/* --- BLOQUE ANÁLISIS DUPONT --- */}
            <div className="p-6 mt-6 border border-secondary rounded-xl bg-secondary/10">
                <h2 className="text-xl font-semibold mb-1 flex items-center gap-2"><TrendingUp /> Análisis DuPont (ROE)</h2>
                <p className="text-subtitle mb-6">Descomposición de la Rentabilidad sobre el Patrimonio (ROE)</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                        <p className="text-2xl font-bold">{dupontMargenNeto.toFixed(1)}%</p>
                        <p className="text-sm text-subtitle">Margen Neto (Rentabilidad)</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{dupontRotacionActivos.toFixed(2)}</p>
                        <p className="text-sm text-subtitle">Rotación de Activos (Eficiencia)</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold">{dupontApalancamiento.toFixed(2)}</p>
                        <p className="text-sm text-subtitle">Apalancamiento (Deuda)</p>
                    </div>
                </div>
            </div>

            {/* --- BLOQUE DE GRÁFICOS --- */}
            <div className="p-6 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <h2 className="text-xl font-semibold mb-6">Comparación con Industria</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={barChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Tu Empresa" fill="#8884d8" />
                            <Bar dataKey="Industria" fill="#82ca9d" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="border border-secondary p-4 rounded-2xl w-full">
                    <h2 className="text-xl font-semibold mb-6">Puntuación de Salud Financiera</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={pieChartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={5}
                                label
                            >
                                {pieChartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={PIE_COLORS[index % PIE_COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}