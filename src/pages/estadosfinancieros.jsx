
import Tabs from "../components/tabs";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Zap, Download } from "lucide-react";
import { supabase } from "../supabase/supabaseclient";
import { useEmpresa } from "../contexts/empresacontext";
import { toast } from "react-hot-toast";
import BalanceGeneralReporte from "../components/balanceGeneralReporte";
import EstadoResultadosReporte from "../components/estadoResultadosReporte";
import FlujoEfectivoReporte from "../components/flujoEfectivoReporte";
import usePersistentState from "../hooks/usePersistentState";
import { exportFinancialReports } from "../utils/exportToExcel";
import EstadoOrigenAplicacionReporte from "../components/estadoOrigenAplicacionReporte";
import BalanzaComprobacionReporte from "../components/balanzaComprobacionReporte";

const getTodayString = () => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
}

export default function EstadosFinancieros() {
    const [cuentasActuales, setCuentasActuales] = useState([]);
    const [cuentasAnteriores, setCuentasAnteriores] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [tabs, setTabs] = useState([
        { key: 'balanzaComprobacion', label: 'Balanza de Comprobación' },
        { key: 'balanceGeneral', label: 'Balance General' },
        { key: 'estadoResultados', label: 'Estado de Resultados' },
        { key: 'flujoEfectivo', label: 'Flujo de Efectivo' },
        { key: 'origenAplicacion', label: 'Origen y Aplicación' },
    ]);
    const [activeTab, setActiveTab] = useState('balanceGeneral');
    const [empresaInfo, setEmpresaInfo] = useState(null);
    const [fechaInicio, setFechaInicio] = usePersistentState(
        'finance_erp_fecha_inicio',
        getTodayString()
    );
    const [fechaCierre, setFechaCierre] = usePersistentState(
        'finance_erp_fecha_cierre',
        getTodayString()
    );
    const [isProcessing, setIsProcessing] = useState(false);
    const { empresaId } = useEmpresa();
    const [datosBalanza, setDatosBalanza] = useState([]);
    const [validacion, setValidacion] = useState(null);
    const [configFiscal, setConfigFiscal] = useState(null);
    const [rangoDatos, setRangoDatos] = useState(null);

    useEffect(() => {
        const validar = async () => {
            if (!empresaId) return;
            try {
                const { data, error } = await supabase.rpc('fn_balanza_comprobacion', {
                    p_desde: '1900-01-01',
                    p_hasta: getTodayString(),
                });
                if (error) throw error;
                const filas = data || [];
                const totalDebe = filas.reduce((s, f) => s + Number(f.debe || 0), 0);
                const totalHaber = filas.reduce((s, f) => s + Number(f.haber || 0), 0);
                const porTipo = {};
                filas.forEach((f) => {
                    const t = (f.tipo_raiz || '').toLowerCase();
                    porTipo[t] = (porTipo[t] || 0) + Number(f.saldo_final || 0);
                });
                const totalActivo = porTipo['activo'] || 0;
                const utilidadPeriodo = Math.abs(porTipo['ingreso'] || 0) - Math.abs(porTipo['costo'] || 0) - Math.abs(porTipo['gasto'] || 0);
                const totalPasivoPatrimonio = Math.abs(porTipo['pasivo'] || 0) + Math.abs(porTipo['patrimonio'] || 0) + utilidadPeriodo;
                const { data: rango } = await supabase
                    .from('comprobantes')
                    .select('fecha_contable')
                    .order('fecha_contable', { ascending: true });
                const fechas = (rango || []).map((r) => r.fecha_contable).filter(Boolean);
                setRangoDatos(fechas.length ? { min: fechas[0], max: fechas[fechas.length - 1] } : null);
                setValidacion({
                    totalDebe,
                    totalHaber,
                    balanceaDebeHaber: Math.abs(totalDebe - totalHaber) < 0.01,
                    totalActivo,
                    totalPasivoPatrimonio,
                    utilidadPeriodo,
                    balanceaEcuacion: Math.abs(Math.abs(totalActivo) - Math.abs(totalPasivoPatrimonio)) < 0.01,
                });
            } catch (err) {
                console.error('Error validando balanza:', err.message);
            }

            try {
                const { data: cf } = await supabase
                    .from('config_fiscal')
                    .select('ir_configurado, tasa_ir')
                    .eq('empresa_id', 1)
                    .maybeSingle();
                setConfigFiscal(cf || null);
            } catch (err) {
                console.error('Error config_fiscal:', err.message);
            }
        };
        validar();
    }, [empresaId]);

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

    const handleGenerarReporte = useCallback(async (showAlerts = false) => {
        if (!fechaInicio || !fechaCierre) {
            toast.error("Seleccione fecha de inicio y cierre");
            return;
        }
        if (!empresaId) return;
        setIsLoading(true);

        let fechaAnterior = new Date(fechaInicio);
        //fechaAnterior.setDate(fechaAnterior.getDate() - 1);
        const fechaInicioReporte = fechaInicio;

        try {
            const { data: dataAnterior, error: errorAnterior } = await supabase.rpc('sp_get_balance_as_of_date', {
                p_id_empresa: empresaId,
                p_fecha_corte: fechaInicioReporte
            });
            if (errorAnterior) throw errorAnterior;
            setCuentasAnteriores((dataAnterior || []).map(c => ({ ...c, saldo: Number(c.saldo) || 0 })));

            const { data: dataActual, error: errorActual } = await supabase.rpc('sp_get_balance_as_of_date', {
                p_id_empresa: empresaId,
                p_fecha_corte: fechaCierre
            });
            if (errorActual) throw errorActual;
            setCuentasActuales((dataActual || []).map(c => ({ ...c, saldo: Number(c.saldo) || 0 })));

            const { data: dataBalanza, error: errorBalanza } = await supabase.rpc('sp_get_balanza_comprobacion', {
                p_id_empresa: empresaId,
                p_fecha_inicio: fechaInicio,
                p_fecha_corte: fechaCierre
            });

            if (errorBalanza) throw errorBalanza;
            setDatosBalanza(dataBalanza || []);

        } catch (error) {
            toast.error(`Error al generar reportes: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [empresaId, fechaInicio, fechaCierre]);

    useEffect(() => {
        handleGenerarReporte();
    }, [handleGenerarReporte]);

    // --- TUS useMemo EN EL LUGAR CORRECTO ---
    const datosActuales = useMemo(() => {
        // ... (Toda la lógica de cálculo para cuentasActuales)
        const activos = cuentasActuales.filter(c => c.tipo === 'Activo' && c.saldo !== 0);
        const pasivos = cuentasActuales.filter(c => c.tipo === 'Pasivo' && c.saldo !== 0);
        const patrimonio = cuentasActuales.filter(c => c.tipo === 'Patrimonio' && c.saldo !== 0);
        const ingresos = cuentasActuales.filter(c => c.tipo === 'Ingreso' && c.saldo !== 0);
        const costos = cuentasActuales.filter(c => c.tipo === 'Costo' && c.saldo !== 0);
        const gastos = cuentasActuales.filter(c => c.tipo === 'Gasto' && c.saldo !== 0);

        const agruparPorSubtipo = (cuentasArray) => {
            return cuentasArray.reduce((acc, cuenta) => {
                const subtipo = cuenta.subtipo || 'Otros';
                if (!acc[subtipo]) {
                    acc[subtipo] = { cuentas: [], total: 0 };
                }
                acc[subtipo].cuentas.push(cuenta);
                acc[subtipo].total += cuenta.saldo;
                return acc;
            }, {});
        };

        const activosAgrupados = agruparPorSubtipo(activos);
        const pasivosAgrupados = agruparPorSubtipo(pasivos);
        const gastosAgrupados = agruparPorSubtipo(gastos);

        const totalActivos = activos.reduce((sum, c) => sum + c.saldo, 0);
        const totalPasivos = pasivos.reduce((sum, c) => sum + c.saldo, 0);
        const totalPatrimonioCuentas = patrimonio.reduce((sum, c) => sum + c.saldo, 0);
        const totalIngresos = ingresos.reduce((sum, c) => sum + c.saldo, 0);
        const totalCostos = costos.reduce((sum, c) => sum + c.saldo, 0);
        const totalGastos = gastos.reduce((sum, c) => sum + c.saldo, 0);
        const utilidadNeta = (totalIngresos * -1) - totalCostos - totalGastos;

        return {
            activosAgrupados,
            pasivosAgrupados,
            patrimonio,
            totalActivos,
            totalPasivos: totalPasivos * -1,
            totalPatrimonioCuentas: totalPatrimonioCuentas * -1,
            ingresosAgrupados: ingresos,
            costosAgrupados: costos,
            gastosAgrupados: gastosAgrupados,
            totalIngresos,
            totalCostos,
            totalGastos,
            utilidadNeta
        };
    }, [cuentasActuales]);

    const datosAnteriores = useMemo(() => {
        // ... (Lógica idéntica para cuentasAnteriores) ...
        const activos = cuentasAnteriores.filter(c => c.tipo === 'Activo' && c.saldo !== 0);
        const pasivos = cuentasAnteriores.filter(c => c.tipo === 'Pasivo' && c.saldo !== 0);
        const patrimonio = cuentasAnteriores.filter(c => c.tipo === 'Patrimonio' && c.saldo !== 0);
        const ingresos = cuentasAnteriores.filter(c => c.tipo === 'Ingreso' && c.saldo !== 0);
        const costos = cuentasAnteriores.filter(c => c.tipo === 'Costo' && c.saldo !== 0);
        const gastos = cuentasAnteriores.filter(c => c.tipo === 'Gasto' && c.saldo !== 0);

        const agruparPorSubtipo = (cuentasArray) => {
            return cuentasArray.reduce((acc, cuenta) => {
                const subtipo = cuenta.subtipo || 'Otros';
                if (!acc[subtipo]) {
                    acc[subtipo] = { cuentas: [], total: 0 };
                }
                acc[subtipo].cuentas.push(cuenta);
                acc[subtipo].total += cuenta.saldo;
                return acc;
            }, {});
        };

        const activosAgrupados = agruparPorSubtipo(activos);
        const pasivosAgrupados = agruparPorSubtipo(pasivos);
        const gastosAgrupados = agruparPorSubtipo(gastos);

        const totalActivos = activos.reduce((sum, c) => sum + c.saldo, 0);
        const totalPasivos = pasivos.reduce((sum, c) => sum + c.saldo, 0);
        const totalPatrimonioCuentas = patrimonio.reduce((sum, c) => sum + c.saldo, 0);
        const totalIngresos = ingresos.reduce((sum, c) => sum + c.saldo, 0);
        const totalCostos = costos.reduce((sum, c) => sum + c.saldo, 0);
        const totalGastos = gastos.reduce((sum, c) => sum + c.saldo, 0);
        const utilidadNeta = (totalIngresos * -1) - totalCostos - totalGastos;

        return {
            activosAgrupados,
            pasivosAgrupados,
            patrimonio,
            totalActivos,
            totalPasivos: totalPasivos * -1,
            totalPatrimonioCuentas: totalPatrimonioCuentas * -1,
            ingresosAgrupados: ingresos,
            costosAgrupados: costos,
            gastosAgrupados: gastosAgrupados,
            totalIngresos,
            totalCostos,
            totalGastos,
            utilidadNeta
        };
    }, [cuentasAnteriores]);

    const handleRegistrarDepreciacion = useCallback(async () => {
        if (!fechaCierre) {
            toast.error("Por favor, selecciona la 'Fecha de cierre' para el proceso.");
            return;
        }
        if (!empresaId) {
            toast.error("No hay empresa seleccionada.");
            return;
        }
        setIsProcessing(true);
        toast.loading("Registrando depreciación...");

        const { error } = await supabase.rpc('sp_registrar_depreciacion_mensual', {
            p_id_empresa: empresaId,
            p_fecha_proceso: fechaCierre
        });

        toast.dismiss();
        if (error) {
            toast.error(`Error al procesar: ${error.message}`);
        } else {
            toast.success("¡Depreciación registrada con éxito!");
            handleGenerarReporte(true); // Refresca los datos
        }
        setIsProcessing(false);
    }, [empresaId, fechaCierre, handleGenerarReporte]);

    return (
        <div className="p-1 mt-4">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex flex-col text-title gap-1 mb-4 ">
                    <h4 className="font-semibold text-xl">Estados Financieros</h4>
                    <p className="text-subtitle">
                        Empresa: {empresaInfo ? empresaInfo.nombre : '...'} | Moneda: {empresaInfo ? empresaInfo.moneda.simbolo : '...'}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row flex-wrap gap-4 w-full lg:w-auto">
                    {/* Inputs de Fecha (se apilan en móvil) */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center">
                        <div className="flex flex-col w-full sm:w-auto">
                            <h4 className="font-semibold text-sm mb-1">Periodo de inicio:</h4>
                            <input type="date" className="border-1 p-2 rounded-lg text-sm text-title w-full" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                        </div>
                        <div className="flex flex-col w-full sm:w-auto">
                            <h4 className="font-semibold text-sm mb-1">Periodo de cierre:</h4>
                            <input type="date" className="border-1 p-2 rounded-lg text-sm text-title w-full" value={fechaCierre} onChange={(e) => setFechaCierre(e.target.value)} />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:items-end">
                        <button className="bg-button text-button px-4 py-2 rounded-lg font-semibold cursor-pointer text-sm" onClick={() => handleGenerarReporte(true)}>
                            Generar
                        </button>
                        <button
                            className="bg-yellow-500 text-black px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                            onClick={handleRegistrarDepreciacion}
                            disabled={isProcessing}
                        >
                            <Zap size={16} />
                            {isProcessing ? "Procesando..." : "Registrar Depreciación"}
                        </button>
                        <button
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
                            onClick={() => exportFinancialReports(datosActuales, datosAnteriores, empresaInfo, fechaInicio, fechaCierre, datosBalanza)}
                            disabled={isLoading || cuentasActuales.length === 0}
                        >
                            <Download size={16} />
                            Exportar
                        </button>
                    </div>
                </div>
            </div>

            {/* Banner de validación contable */}
            {(validacion || configFiscal !== undefined) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className={`rounded-xl p-3 border text-sm ${validacion?.balanceaDebeHaber ? "border-green-500/40 bg-green-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                        <p className="font-semibold text-title">Partida doble (Debe = Haber)</p>
                        <p className={validacion?.balanceaDebeHaber ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                            {validacion ? (validacion.balanceaDebeHaber ? "✓ Cuadra" : "✗ No cuadra") : "..."}
                        </p>
                        {validacion && (
                            <p className="text-subtitle text-xs mt-1">
                                Debe: C$ {validacion.totalDebe.toFixed(2)} · Haber: C$ {validacion.totalHaber.toFixed(2)}
                            </p>
                        )}
                    </div>

                    <div className={`rounded-xl p-3 border text-sm ${validacion?.balanceaEcuacion ? "border-green-500/40 bg-green-500/10" : "border-red-500/40 bg-red-500/10"}`}>
                        <p className="font-semibold text-title">Ecuación contable</p>
                        <p className={validacion?.balanceaEcuacion ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                            {validacion ? (validacion.balanceaEcuacion ? "✓ Activo = Pasivo + Patrimonio" : "✗ Descuadre") : "..."}
                        </p>
                        {validacion && (
                            <p className="text-subtitle text-xs mt-1">
                                Activo: C$ {Math.abs(validacion.totalActivo).toFixed(2)} · Pasivo+Patrimonio+Utilidad: C$ {Math.abs(validacion.totalPasivoPatrimonio).toFixed(2)} (utilidad del período: C$ {Number(validacion.utilidadPeriodo || 0).toFixed(2)})
                            </p>
                        )}
                    </div>

                    <div className={`rounded-xl p-3 border text-sm ${configFiscal?.ir_configurado ? "border-green-500/40 bg-green-500/10" : "border-yellow-500/40 bg-yellow-500/10"}`}>
                        <p className="font-semibold text-title">Configuración de IR</p>
                        <p className={configFiscal?.ir_configurado ? "text-green-400 font-bold" : "text-yellow-500 font-bold"}>
                            {configFiscal?.ir_configurado
                                ? `✓ Tasa IR: ${Number(configFiscal.tasa_ir || 0)}%`
                                : "⚠ IR pendiente de configurar"}
                        </p>
                    </div>
                </div>
            )}

            {!isLoading && cuentasActuales.length > 0 && cuentasActuales.every(c => Math.abs(Number(c.saldo) || 0) < 0.005) && (
                <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800">
                    ⚠ No hay movimientos contables hasta la fecha de cierre seleccionada ({fechaCierre}).
                    {rangoDatos && ` Los asientos registrados van del ${rangoDatos.min} al ${rangoDatos.max}. Ajuste el período y presione Generar.`}
                </div>
            )}

            <Tabs tabs={tabs} activeKey={activeTab} onChange={setActiveTab} />

            {activeTab === 'balanceGeneral' && (
                <div className="mt-4 overflow-x-auto"> 
                    <BalanceGeneralReporte
                        isLoading={isLoading}
                        datosActuales={datosActuales}
                        datosAnteriores={datosAnteriores}
                    />
                </div>
            )}

            {activeTab === 'estadoResultados' && (
                <div className="mt-4">
                    <EstadoResultadosReporte
                        isLoading={isLoading}
                        datosActuales={datosActuales}
                        datosAnteriores={datosAnteriores}
                    />
                </div>
            )}

            {activeTab === 'flujoEfectivo' && (
                <div className="mt-4">
                    <FlujoEfectivoReporte
                        isLoading={isLoading}
                        datosActuales={datosActuales}
                        datosAnteriores={datosAnteriores}
                    />
                </div>
            )}

            {activeTab === 'origenAplicacion' && (
                <div className="mt-4 overflow-x-auto">
                    <EstadoOrigenAplicacionReporte
                        isLoading={isLoading}
                        datosActuales={datosActuales}
                        datosAnteriores={datosAnteriores}
                    />
                </div>
            )}

            {activeTab === 'balanzaComprobacion' && (
                <div className="mt-4 overflow-x-auto">
                    <BalanzaComprobacionReporte
                        isLoading={isLoading}
                        datosBalanza={datosBalanza}
                    />
                </div>
            )}
        </div>
    );
}
