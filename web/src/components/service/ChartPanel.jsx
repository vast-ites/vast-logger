import React from 'react';

const ChartPanel = ({ title, subtitle, children, actions }) => {
    return (
        <div className="bg-gray-800/50 border border-cyan-500/30 rounded-lg p-4 hover:border-cyan-400/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
                </div>
                {actions && (
                    <div className="flex gap-2">
                        {actions}
                    </div>
                )}
            </div>
            <div className="h-64">
                {children}
            </div>
        </div>
    );
};

export default ChartPanel;
