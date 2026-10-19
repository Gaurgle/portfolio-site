// src/components/SidebarToggle.tsx
import React, { useEffect } from 'react';

/** Below this width the sidebar is a drawer; keep in step with lg in global.css. */
const DRAWER_QUERY = "(max-width: 1023px)";
/** The drawer's spring: Apple's sheet values. Slightly underdamped, so a
 *  flick carries into a small settle; the response is in seconds. */
const DAMPING = 0.8;
const RESPONSE = 0.3;
/** Horizontal travel before a touch on the drawer counts as a drag. */
const DRAG_SLOP = 10;
/** Below this release speed (px/s) the position decides, not the direction. */
const FLICK = 80;

/** Progressive resistance past the open edge: the further, the less it follows. */
const rubberband = (over: number, size: number) =>
    (over * size * 0.55) / (size + 0.55 * Math.abs(over));

const SidebarToggle: React.FC = () => {
    useEffect(() => {
        const drawer = window.matchMedia(DRAWER_QUERY);
        const still = window.matchMedia("(prefers-reduced-motion: reduce)");
        const sidebarEl = () => document.getElementById("sidebar");
        const overlayEl = () => document.getElementById("sidebar-overlay");
        const isOpen = () => !sidebarEl()?.classList.contains("-translate-x-full");

        // The drawer's presented offset in px (0 open, -width closed) and
        // its velocity, while a drag or the spring owns it. Otherwise the
        // classes do, and the inline styles are cleared.
        let x = 0;
        let v = 0;
        let width = 1;
        let target = 0;
        let frame = 0;
        let last = 0;

        const present = () => {
            const sidebar = sidebarEl();
            const overlay = overlayEl();
            if (!sidebar) return;
            sidebar.style.transition = "none";
            sidebar.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
            if (overlay) {
                overlay.style.transition = "none";
                overlay.style.opacity = (0.5 * Math.max(0, Math.min(1, 1 + x / width))).toFixed(3);
            }
        };
        const release = () => {
            cancelAnimationFrame(frame);
            frame = 0;
            for (const el of [sidebarEl(), overlayEl()]) {
                el?.style.removeProperty("transition");
                el?.style.removeProperty("transform");
                el?.style.removeProperty("opacity");
            }
        };
        /** Where the drawer is on screen right now: mid-flight it is the
         *  spring's value, so a new motion starts there instead of jumping. */
        const presented = () => (frame || dragging ? x : isOpen() ? 0 : -width);

        // Damped spring, integrated in small steps (semi-implicit Euler).
        const stiffness = (2 * Math.PI / RESPONSE) ** 2;
        const friction = (4 * Math.PI * DAMPING) / RESPONSE;
        const step = (now: number) => {
            let remaining = Math.min(0.034, (now - last) / 1000);
            last = now;
            while (remaining > 0) {
                const h = Math.min(0.004, remaining);
                remaining -= h;
                v += (-stiffness * (x - target) - friction * v) * h;
                x += v * h;
            }
            if (Math.abs(x - target) < 0.5 && Math.abs(v) < 10) {
                release();
                return;
            }
            present();
            frame = requestAnimationFrame(step);
        };
        const springTo = (to: number, velocity: number) => {
            target = to;
            v = velocity;
            if (Math.abs(x - target) < 0.5 && Math.abs(v) < 10) {
                release();
                return;
            }
            present();
            cancelAnimationFrame(frame);
            last = performance.now();
            frame = requestAnimationFrame(step);
        };

        // The drawer is hidden from assistive tech and the tab order only
        // while it is a closed drawer; the desktop sidebar is always there.
        const setState = (open: boolean, velocity = 0) => {
            const sidebar = sidebarEl();
            const overlay = overlayEl();
            const toggle = document.getElementById("sidebar-toggle");
            if (!sidebar) return;
            width = sidebar.offsetWidth || 1;
            const from = presented();
            sidebar.classList.toggle("-translate-x-full", !open);
            const hidden = drawer.matches && !open;
            if (hidden) sidebar.setAttribute("aria-hidden", "true");
            else sidebar.removeAttribute("aria-hidden");
            sidebar.toggleAttribute("inert", hidden);
            overlay?.classList.toggle("is-open", open);
            toggle?.setAttribute("aria-expanded", String(open));
            // Reduced motion and the desktop layout leave it to the classes
            // (from wherever a drag left the drawer, under reduced motion).
            if (!drawer.matches || still.matches) {
                release();
                return;
            }
            x = from;
            springTo(open ? 0 : -width, velocity);
        };

        // Drag to close: the open drawer follows the finger 1:1 once a touch
        // has moved sideways past the slop, and the release direction
        // decides (its position, for a slow release). The spring carries the
        // finger's speed on.
        let pending: { id: number; x: number; y: number } | null = null;
        let dragging = false;
        let grab = 0;
        let history: Array<[number, number]> = [];
        let suppressClick = false;

        const onPointerDown = (e: PointerEvent) => {
            if (!drawer.matches || !isOpen() || !e.isPrimary) return;
            if (!(e.target as Element).closest?.("#sidebar")) return;
            pending = { id: e.pointerId, x: e.clientX, y: e.clientY };
        };
        const onPointerMove = (e: PointerEvent) => {
            if (!pending || e.pointerId !== pending.id) return;
            const sidebar = sidebarEl();
            if (!sidebar) return;
            if (!dragging) {
                const dx = e.clientX - pending.x;
                const dy = e.clientY - pending.y;
                if (Math.abs(dy) > DRAG_SLOP && Math.abs(dy) > Math.abs(dx)) {
                    pending = null;
                    return;
                }
                if (Math.abs(dx) < DRAG_SLOP) return;
                width = sidebar.offsetWidth || 1;
                x = presented();
                cancelAnimationFrame(frame);
                frame = 0;
                dragging = true;
                // Grabbed where the finger is now, so the drawer does not
                // jump by the slop distance.
                grab = e.clientX - x;
                history = [];
                sidebar.setPointerCapture(e.pointerId);
            }
            const raw = e.clientX - grab;
            x = raw > 0 ? rubberband(raw, width) : raw;
            history.push([e.timeStamp, e.clientX]);
            if (history.length > 6) history.shift();
            present();
        };
        const endDrag = (e: PointerEvent, cancelled: boolean) => {
            if (!pending || e.pointerId !== pending.id) return;
            pending = null;
            if (!dragging) return;
            dragging = false;
            suppressClick = !cancelled;
            const recent = history.filter(([t]) => e.timeStamp - t < 100);
            const [t0, x0] = recent[0] ?? [e.timeStamp, e.clientX];
            const [t1, x1] = recent[recent.length - 1] ?? [e.timeStamp, e.clientX];
            const velocity = !cancelled && t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
            const close = Math.abs(velocity) > FLICK ? velocity < 0 : x < -width / 2;
            setState(!close, velocity);
        };
        const onPointerUp = (e: PointerEvent) => endDrag(e, false);
        const onPointerCancel = (e: PointerEvent) => endDrag(e, true);

        // One delegated listener: survives ClientRouter DOM swaps and can
        // never stack duplicate handlers (the old per-button wiring re-added
        // a fresh closure on every page-load, making taps toggle twice).
        const onClick = (e: MouseEvent) => {
            if (suppressClick) {
                // The tap that ended a drag is not a press on a link.
                suppressClick = false;
                if ((e.target as Element).closest?.("#sidebar")) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }
            const target = e.target as HTMLElement;
            if (target.closest("#sidebar-toggle")) {
                setState(!isOpen());
            } else if (target.closest("#sidebar-overlay")) {
                setState(false);
            }
        };
        // Crossing the breakpoint re-applies the attributes for the new layout.
        const onBreakpoint = () => setState(false);
        // A page swap brings a fresh, closed sidebar.
        const onPageLoad = () => {
            release();
            setState(false);
        };

        setState(false);
        document.addEventListener("click", onClick, true);
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
        document.addEventListener("pointercancel", onPointerCancel);
        drawer.addEventListener("change", onBreakpoint);
        document.addEventListener("astro:page-load", onPageLoad);
        return () => {
            release();
            document.removeEventListener("click", onClick, true);
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            document.removeEventListener("pointercancel", onPointerCancel);
            drawer.removeEventListener("change", onBreakpoint);
            document.removeEventListener("astro:page-load", onPageLoad);
        };
    }, []);

    return (
        <>
            {/* The scrim fades in step with the drawer (global.css,
                .sidebar-overlay; the spring drives it on phones); it is only
                hidden once fully faded. */}
            <div
                id="sidebar-overlay"
                className="sidebar-overlay lg:hidden fixed inset-0 z-30 bg-black"
                aria-hidden="true"
            />
            <button
                id="sidebar-toggle"
                className="press lg:hidden fixed top-5 left-4 z-[90] p-2 rounded-lg
                 text-zinc-300 hover:text-zinc-200 transition-colors duration-200"
                aria-label="Toggle navigation"
                aria-controls="sidebar"
                aria-expanded="false"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6"
                     viewBox="0 0 24 24" fill="none" aria-hidden="true"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 6h16M4 12h16M4 18h16"/>
                </svg>
            </button>
        </>
    );
};

export default SidebarToggle;
