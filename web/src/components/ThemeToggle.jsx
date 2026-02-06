import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Zap, ChevronUp, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle = () => {
    const { theme, setTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const themes = [
        { id: 'dark', label: 'Dark Mode', icon: Moon, color: 'text-cyan-400' },
        { id: 'light', label: 'Light Mode', icon: Sun, color: 'text-amber-500' },
    ];

    const currentTheme = themes.find(t => t.id === theme) || themes[0];
    const Icon = currentTheme.icon;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg transition-colors border flex items-center gap-2 hover:bg-cyber-gray text-cyber-muted hover:text-cyber-text border-transparent hover:border-cyber-gray/30"
                title="Select Theme"
            >
                <Icon size={18} className={currentTheme.color} />
                <ChevronUp size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu (Upwards) */}
            {isOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-cyber-black/90 backdrop-blur-xl border border-cyber-gray/30 rounded-lg shadow-xl overflow-hidden z-50">
                    <div className="p-1">
                        {themes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => {
                                    setTheme(t.id);
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-2 rounded-md text-sm transition-colors ${theme === t.id
                                    ? 'bg-cyber-gray/30 text-cyber-text'
                                    : 'text-cyber-muted hover:bg-cyber-gray/20 hover:text-cyber-text'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <t.icon size={16} className={t.color} />
                                    <span>{t.label}</span>
                                </div>
                                {theme === t.id && <Check size={14} className="text-cyan-400" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
