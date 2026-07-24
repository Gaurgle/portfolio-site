// src/components/SidebarToggle.tsx
import React, { useEffect } from 'react';

const SidebarToggle: React.FC = () => {
    useEffect(() => {
        // One delegated listener: survives ClientRouter DOM swaps and can
        // never stack duplicate handlers (the old per-button wiring re-added
        // a fresh closure on every page-load, making taps toggle twice).
        const setState = (hidden: boolean) => {
            const sidebar = document.getElementById("sidebar");
            const overlay = document.getElementById("sidebar-overlay");
            if (!sidebar) return;
            sidebar.classList.toggle("-translate-x-full", hidden);
            sidebar.setAttribute("aria-hidden", String(hidden));
            overlay?.classList.toggle("hidden", hidden);
        };

        const onClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest("#sidebar-toggle")) {
                const sidebar = document.getElementById("sidebar");
                setState(!sidebar?.classList.contains("-translate-x-full"));
            } else if (target.closest("#sidebar-overlay")) {
                setState(true);
            }
        };

        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, []);

    return (
        <>
            <div
                id="sidebar-overlay"
                className="hidden lg:hidden fixed inset-0 z-30 bg-black/50"
            />
            <button
                id="sidebar-toggle"
                className="lg:hidden fixed top-5 left-4 z-[90] p-2 rounded-lg
                 text-zinc-300 hover:text-zinc-200 transition-colors duration-200 focus:outline-none"
                aria-label="Toggle Sidebar"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6"
                     viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            </button>
        </>
    );
};

export default SidebarToggle;