import type { ComponentType } from 'react';
import {
    KotlinIcon,
    Java,
    SpringIcon,
    KtorIcon,
    Android,
    Bluetooth,
    DockerIcon,
    Python,
    Mysql,
    Postgresql,
    ClaudeCode,
    SvelteIcon,
    TailwindIcon,
} from "@dev.icons/react";
// Astro's brand mark is near-black; the monochrome variant reads on a dark background.
import { AstroIcon as AstroMonoIcon } from "@dev.icons/react/mono";
// Exposed has no Devicon; keep the generic monochrome database glyph.
import {DiDatabase} from "react-icons/di";

export type TechEntry = {
    icon: ComponentType<{ className?: string }>;
    name: string;
    // Monochrome fallback icons fade gray → white instead of gray → brand color.
    mono?: boolean;
    // Hover color for mono icons (Tailwind class); defaults to white when omitted.
    monoHover?: string;
};

export const stack: TechEntry[] = [
    {icon: KotlinIcon, name: "Kotlin"},
    {icon: Java, name: "Java"},
    {icon: SpringIcon, name: "Spring"},
    {icon: KtorIcon, name: "Ktor"},
    {icon: DiDatabase, name: "Exposed", mono: true},
    {icon: Android, name: "Android"},
    {icon: Bluetooth, name: "BLE"},
    {icon: DockerIcon, name: "Docker"},
    {icon: Python, name: "Python"},
    {icon: Mysql, name: "MySQL"},
    {icon: Postgresql, name: "PostgreSQL"},
    {icon: AstroMonoIcon, name: "Astro", mono: true, monoHover: "group-hover:text-[#FF5D01]"},
    {icon: SvelteIcon, name: "Svelte"},
    {icon: TailwindIcon, name: "Tailwind"},
    {icon: ClaudeCode, name: "Claude Code"},
];

// Catppuccin gradient stops: green → teal → blue → mauve → pink → peach
const glowColors = [
    [141, 255, 176], // green  #8dffb0
    [63, 232, 210], // teal   #3fe8d2
    [70, 190, 255], // blue   #46beff
    [157, 140, 255], // mauve  #9d8cff
    [255, 107, 139], // pink   #ff6b8b
    [255, 184, 77], // peach  #ffb84d
];

function getGlowColor(index: number, total: number): string {
    const t = total <= 1 ? 0 : index / (total - 1);
    const scaled = t * (glowColors.length - 1);
    const i = Math.floor(scaled);
    const f = scaled - i;
    const a = glowColors[Math.min(i, glowColors.length - 1)];
    const b = glowColors[Math.min(i + 1, glowColors.length - 1)];
    const r = Math.round(a[0] + (b[0] - a[0]) * f);
    const g = Math.round(a[1] + (b[1] - a[1]) * f);
    const bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return `${r}, ${g}, ${bl}`;
}

import { useRef, useCallback, useEffect } from 'react';

export function lerpColor(t: number): string {
    const clamped = Math.max(0, Math.min(1, t));
    const scaled = clamped * (glowColors.length - 1);
    const i = Math.floor(scaled);
    const f = scaled - i;
    const a = glowColors[Math.min(i, glowColors.length - 1)];
    const b = glowColors[Math.min(i + 1, glowColors.length - 1)];
    const r = Math.round(a[0] + (b[0] - a[0]) * f);
    const g = Math.round(a[1] + (b[1] - a[1]) * f);
    const bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return `${r},${g},${bl}`;
}

export default function TechStack({ parentId }: { parentId?: string }) {
    const containerRef = useRef<HTMLDivElement>(null);
    const blobRef = useRef<HTMLDivElement>(null);
    const target = useRef({ x: 0, y: 0 });
    const pos = useRef({ x: 0, y: 0 });
    const rafId = useRef(0);
    const inside = useRef(false);

    const startLoop = useCallback(() => {
        if (rafId.current) return;
        const ease = 0.08;
        const tick = () => {
            pos.current.x += (target.current.x - pos.current.x) * ease;
            pos.current.y += (target.current.y - pos.current.y) * ease;
            if (blobRef.current) {
                blobRef.current.style.left = `${pos.current.x}px`;
                blobRef.current.style.top = `${pos.current.y}px`;
            }
            if (inside.current || Math.abs(target.current.x - pos.current.x) > 0.5 || Math.abs(target.current.y - pos.current.y) > 0.5) {
                rafId.current = requestAnimationFrame(tick);
            } else {
                rafId.current = 0;
            }
        };
        rafId.current = requestAnimationFrame(tick);
    }, []);

    useEffect(() => {
        const parent = parentId ? document.getElementById(parentId) : null;
        if (!parent) return;

        const onMove = (e: MouseEvent) => {
            const container = containerRef.current;
            const blob = blobRef.current;
            if (!container || !blob) return;

            const rect = container.getBoundingClientRect();
            target.current.x = e.clientX - rect.left;
            target.current.y = e.clientY - rect.top;

            // Dim when cursor is above the icon area (title bar)
            const overIcons = e.clientY >= rect.top;
            blob.style.opacity = overIcons ? '0.6' : '0.25';

            const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const rgb = lerpColor(t);
            blob.style.background = `radial-gradient(ellipse at 40% 45%, rgba(${rgb},0.5) 0%, rgba(${rgb},0.15) 35%, transparent 60%)`;
            startLoop();
        };

        const onEnter = (e: MouseEvent) => {
            inside.current = true;
            const container = containerRef.current;
            if (container) {
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                pos.current.x = x;
                pos.current.y = y;
                target.current.x = x;
                target.current.y = y;
            }
            if (blobRef.current) blobRef.current.style.opacity = '0.25';
            startLoop();
        };

        const onLeave = () => {
            inside.current = false;
            if (blobRef.current) blobRef.current.style.opacity = '0';
        };

        parent.addEventListener('mousemove', onMove);
        parent.addEventListener('mouseenter', onEnter);
        parent.addEventListener('mouseleave', onLeave);

        return () => {
            parent.removeEventListener('mousemove', onMove);
            parent.removeEventListener('mouseenter', onEnter);
            parent.removeEventListener('mouseleave', onLeave);
            if (rafId.current) cancelAnimationFrame(rafId.current);
        };
    }, [parentId, startLoop]);

    return (
        <div
            ref={containerRef}
            className="relative flex flex-wrap gap-5 items-center justify-center"
        >
            <div ref={blobRef} className="icon-blob" />
            {stack.map(({icon: Icon, name, mono, monoHover}) => (
                <div
                    key={name}
                    className="tech-icon-wrap relative flex flex-col items-center group cursor-default"
                >
                    <Icon
                        className={
                            mono
                                ? `tech-icon w-8 h-8 text-zinc-500 ${monoHover ?? "group-hover:text-white"} transition-all duration-300`
                                : "tech-icon w-8 h-8 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                        }
                    />
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap font-mono text-[10px] text-zinc-300 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                        {name}
                    </span>
                </div>
            ))}
        </div>
    );
}
