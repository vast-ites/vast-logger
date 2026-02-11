import React from 'react';

const ChartPanel = ({ title, subtitle, children, actions }) => {
    return (
        <div className="glass-panel rounded-lg p-4 hover:border-cyber-cyan/50 transition-colors">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-cyber-text">{title}</h3>
                    {subtitle && <p className="text-sm text-cyber-muted mt-1">{subtitle}</p>}
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
