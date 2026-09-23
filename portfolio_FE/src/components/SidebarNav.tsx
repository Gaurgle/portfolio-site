import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { sketchOnHover } from "../lib/sketch";

// One-page site: links are smooth Lenis anchor jumps; data-spy drives the
// active state set by the scroll spy in smoothScroll.ts. Each link carries
// its chapter's colour as --ink: global.css lights the word with it on
// hover and while its section is active (.nav-link).
const links = [
    { href: "/#home", spy: "home", label: "home", ink: "#8dffb0" },
    { href: "/#about", spy: "about", label: "about", ink: "#9d8cff" },
    { href: "/#journey", spy: "journey", label: "journey", ink: "#3fe8d2" },
    { href: "/#projects", spy: "projects", label: "projects", ink: "#46beff" },
    { href: "/#contact", spy: "contact", label: "contact", ink: "#ffb84d" },
];

export default function SidebarNav() {
    const labelRefs = useRef<Array<HTMLElement | null>>([]);

    useEffect(() => {
        // Hover each link: draw a rough underline in that page's color, reverse on leave
        const cleanups = labelRefs.current.map((el, i) =>
            el
                ? sketchOnHover(el, {
                      color: links[i].ink,
                      type: "underline",
                      strokeWidth: 1.5,
                      padding: 3,
                      drawMs: 420,
                      undrawMs: 220,
                  })
                : null
        );
        return () => cleanups.forEach((c) => c?.());
    }, []);

    return (
        <div className="space-y-1">
            {links.map(({ href, spy, label, ink }, i) => (
                <a
                    key={href}
                    data-spy={spy}
                    className="nav-link block py-1.5 font-mono text-base"
                    style={{ "--ink": ink } as CSSProperties}
                    href={href}
                >
                    <span ref={(el) => (labelRefs.current[i] = el)}>{label}</span>
                </a>
            ))}
        </div>
    );
}
