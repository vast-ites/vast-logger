import React from 'react';

export const StatCard = ({
    label, value, subValue, icon: Icon, trend, trendValue, color = 'cyan'
}) => {

    const colorMap = {
        cyan: 'text-cyan-400',
        violet: 'text-fuchsia-400',
        amber: 'text-amber-400',
        green: 'text-emerald-400',
        red: 'text-rose-400'
    }

    const iconColor = colorMap[color] || 'text-cyan-400';
    const glowColor = color === 'violet' ? 'fuchsia' : color;

    return (
        <div className="glass-panel p-5 relative overflow-hidden group">
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <p className="text-cyber-muted text-xs uppercase tracking-wider font-semibold mb-1">{label}</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className={`text-2xl font-bold tracking-tight ${iconColor}`}>{value}</h3>
                        {subValue && <span className="text-xs text-cyber-muted">{subValue}</span>}
                    </div>

                    {trend && (
                        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-cyber-muted'}`}>
                            <span>{trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}</span>
                            <span>{trendValue}</span>
                            <span className="text-cyber-muted ml-1">vs last hour</span>
                        </div>
                    )}
                </div>

                <div className={`p-2 rounded-lg bg-cyber-gray/10 border border-cyber-gray/20 ${iconColor} shadow-[0_0_10px_rgba(0,0,0,0.2)]`}>
                    <Icon size={20} />
                </div>
            </div>

            {/* Background Glow Effect */}
            <div className={`absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-${glowColor}-500/20 to-transparent blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700`}></div>
        </div>
    );
};
