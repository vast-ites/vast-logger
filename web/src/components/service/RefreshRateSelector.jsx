import React from 'react';
import { RefreshCw } from 'lucide-react';

const RefreshRateSelector = ({ value, onChange }) => {
    const rates = [
        { label: 'Off', value: 0 },
        { label: '5s', value: 5 },
        { label: '10s', value: 10 },
        { label: '30s', value: 30 },
        { label: '1m', value: 60 },
    ];

    return (
        <div className="flex items-center gap-2 bg-gray-800/50 border border-cyan-500/30 rounded-lg p-1">
            <RefreshCw className="w-4 h-4 text-cyan-400 ml-2" />
            {rates.map((rate) => (
                <button
                    key={rate.value}
                    onClick={() => onChange(rate.value)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${value === rate.value
                            ? 'bg-cyan-500 text-white'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                >
                    {rate.label}
                </button>
            ))}
        </div>
    );
};

export default RefreshRateSelector;
