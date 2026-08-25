
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
            setCuentasAnteriores(dataAnterior || []);

            const { data: dataActual, error: errorActual } = await supabase.rpc('sp_get_balance_as_of_date', {
                p_id_empresa: empresaId,
                p_fecha_corte: fechaCierre
            });
            if (errorActual) throw errorActual;
            setCuentasActuales(dataActual || []);

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
