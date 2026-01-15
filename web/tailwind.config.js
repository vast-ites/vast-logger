/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                cyber: {
                    black: '#0a0a1f', // Deep space black
                    dark: '#0f0f2d',  // Slightly lighter background
                    gray: '#1a1a3a',  // Panel background
                    cyan: '#00f3ff',  // Primary Neon
                    magenta: '#ff00ff', // Secondary Neon
                    green: '#0aff0a', // Success Neon
                    yellow: '#f3ff00', // Warning Neon
                    red: '#ff003c',   // Danger Neon
                    dim: '#rgba(0, 243, 255, 0.1)',
                }
            },
            fontFamily: {
                mono: ['"Fira Code"', 'monospace'], // For data
                sans: ['"Orbitron"', '"Inter"', 'sans-serif'], // For headers
            },
            boxShadow: {
                'neon-cyan': '0 0 10px #00f3ff, 0 0 20px #00f3ff',
                'neon-magenta': '0 0 10px #ff00ff, 0 0 20px #ff00ff',
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, #1a1a3a 1px, transparent 1px), linear-gradient(to bottom, #1a1a3a 1px, transparent 1px)",
            },
        },
    },
    plugins: [],
}
