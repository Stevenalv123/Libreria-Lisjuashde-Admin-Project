import { X, ChartColumn, DollarSign, Search, TrendingUp, Send, User } from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { generateContent } from "../contexts/model";
import ReactMarkdown from "react-markdown";

// --- Hooks y helpers de datos ---
import { useEmpresa } from "../contexts/empresacontext";
import { supabase } from "../supabase/supabaseclient";
import { toast } from "react-hot-toast";
import usePersistentState from "../hooks/usePersistentState";

const systemPrompt = `Eres FinanceBot, un analista financiero experto de IA. Tu propósito es proporcionar análisis basados en datos y apoyo a los dueños de negocios, basándote *exclusivamente* en los datos de su sistema interno. Tu tono debe ser profesional, objetivo y perspicaz.
Directivas Principales:
1.  **Analiza los Datos Proporcionados**: Se te proporcionará un bloque de 'Contexto de Datos' que contiene los ratios financieros clave de la empresa. Debes usar *exclusivamente* estos datos.
2.  **Resume la Salud Financiera**: Cuando el usuario pida un análisis ("¿cómo está mi empresa?"), sintetiza los datos del 'Contexto de Datos' en un resumen claro de alto nivel.
3.  **Identifica Perspectivas Clave**: No te limites a listar números. Explica qué significan. Identifica fortalezas (ej. "Tu liquidez es excelente") y preocupaciones (ej. "Tu rentabilidad está por debajo del promedio de la industria").
4.  **Sé Basado en Datos**: Usa números específicos del contexto para respaldar cada afirmación.

Restricciones Críticas:
-   **NUNCA ALUCINES**: No inventes números o datos. Si la información no está en el 'Contexto de Datos' (ej. "flujo de caja histórico"), indica que no puedes proporcionar ese análisis específico.
-   **SIN CONSEJOS EXTERNOS**: No des consejos financieros personalizados (ej. "deberías invertir en acciones"). Tu consejo debe estar estrictamente relacionado con los datos internos (ej. "Tu rotación de inventario es lenta, considera estrategias para mover el stock más rápido").
`;

const getTodayString = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
}

const findSaldo = (cuentas, nombres) => {
    const nombresLower = nombres.map(n => n.toLowerCase());
    let total = 0;
    cuentas.forEach(cuenta => {
        if (nombresLower.includes(cuenta.cuenta?.toLowerCase())) {
            total += cuenta.saldo;
        }
    });
    return total;
};

const INDUSTRY_AVERAGES = {
    liquidezCorriente: 1.75,
    endeudamiento: 0.4, // 40%
    roe: 15.0, // 15%
};

export default function BotComponent({ onClose }) {
    const [userInput, setUserInput] = useState('');
    const [response, setResponse] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // --- 1. LÓGICA DE DATOS FINANCIEROS ---
    const [cuentasActuales, setCuentasActuales] = useState([]);
    const [cuentasAnteriores, setCuentasAnteriores] = useState([]);
    const { empresaId } = useEmpresa();
    const [fechaInicio] = usePersistentState('finance_erp_fecha_inicio', getTodayString());
    const [fechaCierre] = usePersistentState('finance_erp_fecha_cierre', getTodayString());

    const fetchFinancialData = useCallback(async () => {
        if (!empresaId || !fechaInicio || !fechaCierre) return;

        let fechaAnterior = new Date(fechaInicio);
        fechaAnterior.setDate(fechaAnterior.getDate() - 1);
        const fechaInicioReporte = fechaAnterior.toISOString().split('T')[0];

        try {
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
            console.error("Error cargando datos para el Bot:", error.message);
        }
    }, [empresaId, fechaInicio, fechaCierre]);

    // Carga los datos financieros tan pronto como se abre el modal
    useEffect(() => {
        fetchFinancialData();
    }, [fetchFinancialData]);

    // --- 2. LÓGICA DE CÁLCULO DE RATIOS ---
    const financialData = useMemo(() => {
        const calcularRatios = (cuentas) => {
            // ... (toda la lógica de 'calcularRatios' de AnalisisFinanciero.jsx)
            const activos = cuentas.filter(c => c.tipo === 'Activo');
            const pasivos = cuentas.filter(c => c.tipo === 'Pasivo');
            const patrimonioCuentas = cuentas.filter(c => c.tipo === 'Patrimonio');
            const ingresos = cuentas.filter(c => c.tipo === 'Ingreso');
            const costos = cuentas.filter(c => c.tipo === 'Costo');
            const gastos = cuentas.filter(c => c.tipo === 'Gasto');
            const totalVentas = Math.abs(findSaldo(ingresos, ["Ventas"]));
            const totalCostosVenta = findSaldo(costos, ["Costo de Venta"]);
            const utilidadBruta = totalVentas - totalCostosVenta;
            const totalGastosOp = findSaldo(gastos, ["Gasto por Depreciación", "Otros Gastos"]);
            const utilidadOperativa = utilidadBruta - totalGastosOp;
            const impuestoIR = utilidadOperativa > 0 ? utilidadOperativa * 0.3 : 0;
            const utilidadNeta = utilidadOperativa - impuestoIR;
            const totalActivoCorriente = activos.filter(c => c.subtipo === 'Activo Corriente').reduce((sum, c) => sum + c.saldo, 0);
            const totalActivoNoCorriente = activos.filter(c => c.subtipo === 'Activo No Corriente').reduce((sum, c) => sum + c.saldo, 0);
            const totalActivos = totalActivoCorriente + totalActivoNoCorriente;
            const totalPasivoCorriente = Math.abs(pasivos.filter(c => c.subtipo === 'Pasivo Corriente').reduce((sum, c) => sum + c.saldo, 0));
            const totalPasivoNoCorriente = Math.abs(pasivos.filter(c => c.subtipo === 'Pasivo No Corriente').reduce((sum, c) => sum + c.saldo, 0));
            const totalPasivos = totalPasivoCorriente + totalPasivoNoCorriente;
            const totalPatrimonioCuentas = Math.abs(patrimonioCuentas.reduce((sum, c) => sum + c.saldo, 0));
            const totalPatrimonio = totalPatrimonioCuentas;
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

        if (cuentasActuales.length === 0) {
            return { error: "No hay datos cargados." }; // Retorno simple si no hay datos
        }

        const actualYTD = calcularRatios(cuentasActuales);
        const anteriorYTD = calcularRatios(cuentasAnteriores);
        const periodoVentas = actualYTD.totalVentas - anteriorYTD.totalVentas;
        const periodoUtilidadNeta = actualYTD.utilidadNeta - anteriorYTD.utilidadNeta;
        const d = (den) => (den === 0 ? 0 : den);
        const liquidezCorriente = actualYTD.totalActivoCorriente / d(actualYTD.totalPasivoCorriente);
        const endeudamiento = actualYTD.totalPasivos / d(actualYTD.totalActivos);
        const margenNeto = (periodoUtilidadNeta / d(periodoVentas)) * 100;
        const roe = (periodoUtilidadNeta / d(actualYTD.totalPatrimonio)) * 100;
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

        return {
            error: null,
            generalScore, generalStatus,
            liquidezCorriente, liquidezStatus,
            endeudamiento, endeudamientoStatus,
            margenNeto, roe, rentabilidadStatus,
            totalVentas: periodoVentas,
            utilidadNeta: periodoUtilidadNeta
        };
    }, [cuentasActuales, cuentasAnteriores]);


    const handleUserInput = (e) => {
        setUserInput(e.target.value);
    };

    const handleClear = () => {
        setUserInput('');
        setResponse([]);
        setIsLoading(false);
    };

    const handleSubmit = async () => {
        if (!userInput.trim()) return;

        const newUserMessage = { type: "user", message: userInput };
        const currentChatHistory = [...response, newUserMessage];
        setResponse(currentChatHistory);
        setUserInput('');
        setIsLoading(true);

        // --- 3. CREA EL CONTEXTO DE DATOS PARA LA IA ---
        let dataContext = "--- INICIO DE DATOS FINANCIEROS (CONFIDENCIAL) ---\n";
        if (financialData.error) {
            dataContext += `Estado: Error. Los datos financieros no pudieron ser calculados. Fechas seleccionadas: ${fechaInicio} a ${fechaCierre}. Informa al usuario que debe generar los reportes primero en la pestaña 'Estados Financieros'.\n`;
        } else {
            dataContext += `
            Fechas del Reporte: ${fechaInicio} a ${fechaCierre}
            Puntuación General: ${financialData.generalScore.toFixed(0)}/100 (${financialData.generalStatus})
            DATOS DEL PERÍODO:
            - Ventas Totales: C$ ${financialData.totalVentas.toFixed(2)}
            - Utilidad Neta: C$ ${financialData.utilidadNeta.toFixed(2)}
            RATIOS CLAVE:
            - Liquidez Corriente: ${financialData.liquidezCorriente.toFixed(2)} (Estado: ${financialData.liquidezStatus})
            - Nivel de Endeudamiento: ${(financialData.endeudamiento * 100).toFixed(1)}% (Estado: ${financialData.endeudamientoStatus})
            - Margen Neto: ${financialData.margenNeto.toFixed(1)}%
            - ROE (Retorno s/ Patrimonio): ${financialData.roe.toFixed(1)}% (Estado: ${financialData.rentabilidadStatus})
        `;
        }
        dataContext += "--- FIN DE DATOS FINANCIEROS ---";
        // --- FIN DEL CONTEXTO ---

        const historyString = currentChatHistory
            .map(msg => {
                if (msg.type === 'user') return `User: ${msg.message}`;
                if (msg.type === 'bot') return `Bot: ${msg.message}`;
                return '';
            })
            .join('\n');

        // --- 4. INYECTA EL CONTEXTO EN EL PROMPT ---
        const fullPrompt = `${systemPrompt}\n\n${dataContext}\n\n--- Historial de Conversación ---\n${historyString}`;

        try {
            const res = await generateContent(fullPrompt);
            const botMessage = { type: "bot", message: res };

            setResponse(prevResponse => [
                ...prevResponse,
                botMessage,
            ]);

        } catch (err) {
            console.error("Error generating response:", err);
            setResponse(prevResponse => [
                ...prevResponse,
                { type: "system", message: "Error al generar la respuesta. Intenta de nuevo." },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-primary border border-secondary rounded-2xl shadow-2xl w-full max-w-md relative flex flex-col" style={{ minHeight: 480 }}>
            <div className="flex items-center justify-between p-4 border-b border-secondary">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold">
                        <span role="img" aria-label="Bot">🤖</span>
                    </div>
                    <div>
                        <h2 className="text-title text-lg font-semibold">AI Financial</h2>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button className="text-subtitle cursor-pointer hover:text-title" onClick={onClose}><X size={20} /></button>
                </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto" style={{ maxHeight: 320 }}>
                {response.length === 0 && (
                    <>
                        <h3 className="text-title text-base font-semibold mb-2">Tu Asistente Financiero</h3>
                        <p className="text-subtitle text-sm mb-4">He cargado tus datos financieros. Pregúntame lo que sea sobre tu empresa.</p>
                        <ul className="flex flex-col gap-3">
                            <li className="flex items-center gap-2">
                                <Search className="text-title w-5 h-5" />
                                <span>Analiza la salud financiera</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <TrendingUp className="text-title w-5 h-5" />
                                <span>¿Cuál es mi rentabilidad este mes?</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <DollarSign className="text-title w-5 h-5" />
                                <span>¿Cuáles son mis gastos más grandes?</span>
                            </li>
                            <li className="flex items-center gap-2">
                                <ChartColumn className="text-title w-5 h-5" />
                                <span>Compárame con la industria</span>
                            </li>
                        </ul>
                    </>
                )}
                {response.map((msg, idx) => (
                    <div key={idx} className={
                        msg.type === "user"
                            ? "flex items-start gap-2 justify-end"
                            : "flex items-start gap-2"
                    }>
                        {msg.type === "bot" && (
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                <span role="img" aria-label="Bot">🤖</span>
                            </div>
                        )}

                        <div className={
                            msg.type === "user"
                                ? "bg-input rounded-xl px-4 py-2 text-title text-base font-medium max-w-[80%]"
                                : msg.type === "bot"
                                    ? "bg-secondary rounded-xl px-4 py-2 text-title text-base max-w-[80%] prose prose-sm prose-invert"
                                    : "bg-red-900/50 rounded-xl px-4 py-2 text-red-200 text-xs text-center w-full"
                        }>
                            {msg.type === "bot"
                                ? <ReactMarkdown children={msg.message} />
                                : <span>{msg.message}</span>
                            }
                        </div>

                        {msg.type === "user" && (
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                <User className="text-title w-5 h-5" />
                            </div>
                        )}
                    </div>
                ))}
                {isLoading && (
                    <div className="flex items-center gap-2 animate-pulse">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <span role="img" aria-label="Bot">🤖</span>
                        </div>
                        <span className="text-subtitle">Pensando...</span>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-secondary flex flex-col gap-2">
                <div className="flex items-center gap-2 bg-input rounded-lg px-3 py-2">
                    <input
                        type="text"
                        className="flex-1 bg-transparent outline-none text-title text-base"
                        placeholder="Pregunta, busca o crea lo que quieras..."
                        value={userInput}
                        onChange={handleUserInput}
                        onKeyDown={e => e.key === 'Enter' ? handleSubmit() : null}
                        disabled={isLoading}
                    />
                    <button className="bg-button rounded-full w-8 h-8 cursor-pointer flex items-center justify-center hover:scale-110 transition-transform" onClick={handleSubmit} disabled={isLoading || !userInput.trim()}>
                        <Send className="text-button w-5 h-5" />
                    </button>
                </div>
                <div className="flex flex-col sm:flex-row justify-between gap-2 text-xs text-subtitle">
                    <span>Automático</span>
                    <span>•</span>
                    <span>Todas las fuentes</span>
                    <button className="ml-auto text-xs text-subtitle hover:text-title" onClick={handleClear}>Limpiar</button>
                </div>
            </div>
        </div >
    );
}
