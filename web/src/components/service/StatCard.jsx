import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const StatCard = ({ title, value, max, unit = '', trend, status, icon: Icon, subtitle }) => {
    const getTrendIcon = () => {
        if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-400" />;
        if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-400" />;
        return <Minus className="w-4 h-4 text-gray-400" />;
    };

    const getStatusColor = () => {
        if (status === 'ok' || status === 'good') return 'border-green-500/30 bg-green-500/5';
        if (status === 'warning') return 'border-yellow-500/30 bg-yellow-500/5';
        if (status === 'error' || status === 'critical') return 'border-red-500/30 bg-red-500/5';
        return 'border-cyan-500/30 bg-gray-800/50';
    };

    const percentage = max ? ((value / max) * 100).toFixed(1) : null;

    return (
        <div className={`rounded-lg border ${getStatusColor()} p-4 hover:border-cyan-400/50 transition-colors`}>
            <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                    {Icon && <Icon className="w-5 h-5 text-cyan-400" />}
                    <span className="text-sm text-gray-400">{title}</span>
                </div>
                {trend && getTrendIcon()}
            </div>

            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                    {value !== undefined && value !== null ? value.toLocaleString() : '-'}
                </span>
                {unit && <span className="text-sm text-gray-400">{unit}</span>}
            </div>

            {max && (
                <div className="mt-2">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Used</span>
                        <span>{percentage}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full transition-all ${percentage > 90 ? 'bg-red-500' :
                                    percentage > 75 ? 'bg-yellow-500' : 'bg-cyan-500'
                                }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        Max: {max.toLocaleString()}
                    </div>
                </div>
            )}

            {subtitle && (
                <div className="mt-2 text-xs text-gray-500">
                    {subtitle}
                </div>
            )}
        </div>
    );
};

export default StatCard;
