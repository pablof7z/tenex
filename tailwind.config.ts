import type { Config } from "tailwindcss";

const config = {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{ts,tsx}",
        "./components/**/*.{ts,tsx}",
        "./app/**/*.{ts,tsx}",
        "./src/**/*.{ts,tsx}",
        "*.{js,ts,jsx,tsx,mdx}",
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                serif: ["var(--font-inter)", "inter", "system-ui", "sans-serif"],
                sans: ["var(--font-inter)", "inter", "system-ui", "sans-serif"],
                mono: ["var(--font-mono)", "monospace"],
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
            },
            boxShadow: {
                subtle: "0 1px 3px rgba(0,0,0,0.05)",
            },
        },
    },
    plugins: [
        require("tailwindcss-animate"),
        require("@tailwindcss/typography")({
            theme: {
                DEFAULT: {
                    css: {
                        fontFamily: 'var(--font-inter), system-ui, sans-serif',
                        '--tw-prose-body': 'var(--foreground)',
                        '--tw-prose-headings': 'var(--foreground)',
                        '--tw-prose-lead': 'var(--muted-foreground)',
                        '--tw-prose-links': 'var(--primary)',
                        '--tw-prose-bold': 'var(--foreground)',
                        '--tw-prose-counters': 'var(--muted-foreground)',
                        '--tw-prose-bullets': 'var(--muted-foreground)',
                        '--tw-prose-hr': 'var(--border)',
                        '--tw-prose-quotes': 'var(--foreground)',
                        '--tw-prose-quote-borders': 'var(--border)',
                        '--tw-prose-captions': 'var(--muted-foreground)',
                        '--tw-prose-code': 'var(--foreground)',
                        '--tw-prose-pre-code': 'var(--muted-foreground)',
                        '--tw-prose-pre-bg': 'var(--muted)',
                        '--tw-prose-th-borders': 'var(--border)',
                        '--tw-prose-td-borders': 'var(--border)',
                    },
                },
            },
        })
    ],
} satisfies Config;

export default config;
