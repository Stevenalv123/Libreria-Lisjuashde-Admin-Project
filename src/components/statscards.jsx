export default function StatsCards({ title, value, icon }) {
    return (
        <div className="w-full rounded-xl border-1 border-secondary p-6 sm:p-8 flex flex-col justify-between gap-3 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                    <span className="block text-title text-lg sm:text-xl font-semibold truncate">{title}</span>
                </div>

                {icon && (
                    <div className="flex-shrink-0 ml-2">
                        <div className="h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-full bg-secondary/10 text-title">
                            <span className="icon">{icon}</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-2">
                <span className="text-title text-2xl sm:text-3xl font-bold">{value}</span>
            </div>
        </div>
    );
}