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
                    black: 'rgb(var(--cyber-black) / <alpha-value>)',
                    dark: 'rgb(var(--cyber-dark) / <alpha-value>)',
                    gray: 'rgb(var(--cyber-gray) / <alpha-value>)',
                    cyan: 'rgb(var(--cyber-cyan) / <alpha-value>)',
                    magenta: 'rgb(var(--cyber-magenta) / <alpha-value>)',
                    green: 'rgb(var(--cyber-green) / <alpha-value>)',
                    yellow: 'rgb(var(--cyber-yellow) / <alpha-value>)',
                    red: 'rgb(var(--cyber-red) / <alpha-value>)',
                    dim: 'rgb(var(--cyber-cyan) / 0.1)', // Derived from cyan with opacity
                    text: 'rgb(var(--text-main) / <alpha-value>)',
                    muted: 'rgb(var(--text-muted) / <alpha-value>)',
                }
            },
            fontFamily: {
                mono: ['"Fira Code"', 'monospace'], // For data
                sans: ['"Orbitron"', '"Inter"', 'sans-serif'], // For headers
            },
            boxShadow: {
                'neon-cyan': '0 0 10px rgb(var(--cyber-cyan)), 0 0 20px rgb(var(--cyber-cyan))',
                'neon-magenta': '0 0 10px rgb(var(--cyber-magenta)), 0 0 20px rgb(var(--cyber-magenta))',
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, #1a1a3a 1px, transparent 1px), linear-gradient(to bottom, #1a1a3a 1px, transparent 1px)",
            },
        },
    },
    plugins: [],
}
