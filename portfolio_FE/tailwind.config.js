// tailwind.config.js
export default {
    content: [
        "./src/**/*.{html,js,jsx,ts,tsx,astro}",
    ],
    theme: {
        fontFamily: {
            sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
            mono: ['"Noto Sans Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
            ramose: ["Ramose", "cursive"],
        },
        extend: {
            colors: {
                ctp: {
                    crust:    '#020204',
                    mantle:   '#050609',
                    base:     '#07080d',
                    surface0: '#1a1d29',
                    surface1: '#2a2e3f',
                    surface2: '#3c4156',
                    overlay0: '#646b80',
                    overlay1: '#7a8299',
                    overlay2: '#9098b0',
                    subtext0: '#a8b0c8',
                    subtext1: '#c0c8de',
                    text:     '#e6ecff',
                    green:    '#8dffb0',
                    red:      '#ff465a',
                    yellow:   '#ffe066',
                    peach:    '#ffb84d',
                    mauve:    '#9d8cff',
                    pink:     '#ff6b8b',
                    blue:     '#46beff',
                    lavender: '#c5d2ff',
                    teal:     '#3fe8d2',
                },
            },
            keyframes: {
                blob: {
                    "0%":   { transform: "translate(0px, 0px) scale(1) rotate(0deg)" },
                    "33%":  { transform: "translate(30px, -50px) scale(1.1) rotate(10deg)" },
                    "66%":  { transform: "translate(-20px, 20px) scale(0.9) rotate(-5deg)" },
                    "100%": { transform: "translate(0px, 0px) scale(1) rotate(0deg)" },
                },
                "border-beam": {
                    "100%": { "offset-distance": "100%" },
                },
                "fade-up": {
                    "0%":   { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "fade-in": {
                    "0%":   { opacity: "0" },
                    "100%": { opacity: "1" },
                },
            },
            animation: {
                blob: "blob 7s infinite ease-in-out",
                "border-beam": "border-beam calc(var(--duration)*1s) infinite linear",
                "fade-up": "fade-up 0.6s ease-out forwards",
                "fade-in": "fade-in 0.8s ease-out forwards",
            },
        },
    },
    plugins: [],
};
