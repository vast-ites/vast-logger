import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
    // Check localStorage or system preference (future)
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });

    useEffect(() => {
        const root = window.document.documentElement;
        // Tailwind usually looks for class on HTML or BODY. 
        // Our CSS setup uses .light override.
        // If theme is light, add class 'light' to body (or root).
        // Let's use document.body to match index.css targeting.

        // Reset classes
        document.body.classList.remove('light');

        if (theme !== 'dark') {
            document.body.classList.add(theme);
        }

        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'dark') return 'light';
            return 'dark';
        });
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
