import React from 'react';

export const Card = ({ children, className = '' }) => {
    return (
        <div className={`glass-panel p-6 ${className}`}>
            {children}
        </div>
    );
};

export const CardHeader = ({ children, className = '' }) => {
    return (
        <div className={`flex justify-between items-start mb-6 ${className}`}>
            {children}
        </div>
    );
};

export const CardTitle = ({ children, icon, className = '' }) => {
    return (
        <h3 className={`text-lg font-bold text-cyber-text flex items-center gap-2 ${className}`}>
            {icon}
            {children}
        </h3>
    );
};
