import React from 'react';

export const OverviewCard = ({ label, value, subValue, icon: Icon, color }) => {
    // Map generic colors to specific hex values for the neon glow
    const colorMap = {
        'cyan': '#00f3ff',
        'violet': '#bc13fe',
        'magenta': '#ff00ff', // fallback
        'green': '#0aff0a',
        'red': '#ff0000',
    };

    const hex = colorMap[color] || '#00f3ff';

    // Tailwind text class mapping
    const textBase = {
        'cyan': 'text-cyan-400',
        'violet': 'text-violet-400',
        'green': 'text-green-400',
        'red': 'text-red-500',
    };

    const textColor = textBase[color] || 'text-cyan-400';

    return (
        <div className="bg-[#0a0b1e] border border-white/5 rounded-xl p-6 relative overflow-hidden group hover:border-white/10 transition-colors">
            {/* Header / Label */}
            <h3 className="text-gray-500 font-mono text-[10px] uppercase tracking-widest mb-2 font-bold">{label}</h3>

            {/* Main Value */}
            <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-4xl font-bold font-sans tracking-tight ${textColor} text-shadow-neon`}>
                    {value}
                </span>
                {/* Optional small unit or static text if needed, usually passed in value */}
            </div>

            {/* Sub Value / Trend */}
            <div className="text-gray-500 text-xs font-mono flex items-center gap-1">
                {subValue}
            </div>

            {/* Icon Box (Right Aligned) */}
            <div className={`absolute top-6 right-6 p-3 rounded-lg bg-white/5 ${textColor} border border-white/5`}>
                <Icon size={20} />
            </div>

            {/* Bottom Accent Line (Optional, similar to screenshot if any) */}
            {/* Screenshot shows clean dark cards without progress bars on some, but let's keep it clean or add a subtle glow */}
        </div>
    );
};
