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
        <div className="flex items-center gap-2 bg-gray-800/50 border border-cyan-500/30 rounded-lg p-1">
            <Clock className="w-4 h-4 text-cyan-400 ml-2" />
            {ranges.map((range) => (
                <button
                    key={range.value}
                    onClick={() => onChange(range.value)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${value === range.value
                            ? 'bg-cyan-500 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );
};

export default TimeRangeSelector;
