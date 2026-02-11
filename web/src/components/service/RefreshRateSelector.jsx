import React from 'react';
import { RefreshCw } from 'lucide-react';

const RefreshRateSelector = ({ value, onChange }) => {
    const rates = [
        { label: 'Off', value: 0 },
        { label: '1s', value: 1 },
        { label: '5s', value: 5 },
        { label: '10s', value: 10 },
        { label: '30s', value: 30 },
        { label: '1m', value: 60 },
    ];

    return (
        <div className="flex items-center gap-2 bg-cyber-gray/20 border border-cyber-dim rounded-lg p-1">
            <RefreshCw className="w-4 h-4 text-cyber-cyan ml-2" />
            {rates.map((rate) => (
                <button
                    key={rate.value}
                    onClick={() => onChange(rate.value)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${value === rate.value
                        ? 'bg-cyber-cyan text-white'
                        : 'text-cyber-muted hover:text-cyber-text hover:bg-cyber-gray/50'
                        }`}
                >
                    {rate.label}
                </button>
            ))}
        </div>
    );
};

export default RefreshRateSelector;
