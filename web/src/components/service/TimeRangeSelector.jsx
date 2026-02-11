import React from 'react';
import { Clock } from 'lucide-react';

const TimeRangeSelector = ({ value, onChange }) => {
    const ranges = [
        { label: '5m', value: '5m' },
        { label: '15m', value: '15m' },
        { label: '1h', value: '1h' },
        { label: '6h', value: '6h' },
        { label: '24h', value: '24h' },
        { label: '7d', value: '7d' },
    ];

    return (
        <div className="flex items-center gap-2 bg-cyber-gray/20 border border-cyber-dim rounded-lg p-1">
            <Clock className="w-4 h-4 text-cyber-cyan ml-2" />
            {ranges.map((range) => (
                <button
                    key={range.value}
                    onClick={() => onChange(range.value)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${value === range.value
                        ? 'bg-cyber-cyan text-white'
                        : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-gray/50'
                        }`}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
};

export default TimeRangeSelector;
