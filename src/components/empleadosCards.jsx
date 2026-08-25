import { DollarSign, Pencil, Trash } from "lucide-react"

export default function EmpleadosCards({ nombre_completo, identificacion, email, telefono, salario_mensual, estado }) {
    return (
        <div className="flex flex-col md:flex-row border border-secondary rounded-lg p-4 justify-between md:items-center shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex flex-col">
                <div className="flex flex-row gap-2 items-center mb-2 flex-wrap">
                    <h4 className="font-semibold text-title text-lg">{nombre_completo}</h4>
                    <div>
                        <span className={`text-xs rounded-[20px] py-1 px-3 ${estado === 'Activo'
                            ? 'bg-button text-button'
                            : 'bg-red-600/20 text-red-400'
                            }`}>
                            {estado || 'Activo'}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center md:gap-2 text-sm text-subtitle mb-1">
                    <span>{identificacion}</span>
                    <span className="hidden md:inline">|</span>
                    <span>{email}</span>
                    <span className="hidden md:inline">|</span>
                    <span>{telefono}</span>
                </div>
                <p><span className="text-subtitle">Salario: </span>C$ {(salario_mensual || 0).toFixed(2)}</p>
            </div>
            <div className="flex flex-row flex-wrap gap-3 items-center mt-4 md:mt-0">
                <button className="border border-secondary text-title p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition">Dar de baja</button>
                <button className="border border-secondary text-green-500 p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition flex items-center gap-1">
                    <DollarSign size={14} /> Pagar Salario
                </button>
                <button className="border border-secondary text-title p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition"><Pencil size={14} /></button>
                <button className="border border-secondary text-title p-2 rounded-[10px] text-xs cursor-pointer hover:scale-110 transition"><Trash size={14} /></button>
            </div>
        </div>
    );
}