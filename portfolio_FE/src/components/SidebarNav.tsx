import { useEffect, useRef } from "react";
import { sketchOnHover } from "../lib/sketch";

// One-page site: links are smooth Lenis anchor jumps; data-spy drives the
// active state set by the scroll spy in smoothScroll.ts.
const links = [
    { href: "/#home", spy: "home", label: "home", color: "text-ctp-green/60", hoverColor: "group-hover:text-ctp-green", ink: "#8dffb0" },
    { href: "/#about", spy: "about", label: "about", color: "text-ctp-mauve/60", hoverColor: "group-hover:text-ctp-mauve", ink: "#9d8cff" },
    { href: "/#journey", spy: "journey", label: "journey", color: "text-ctp-teal/60", hoverColor: "group-hover:text-ctp-teal", ink: "#3fe8d2" },
    { href: "/#projects", spy: "projects", label: "projects", color: "text-ctp-blue/60", hoverColor: "group-hover:text-ctp-blue", ink: "#46beff" },
    { href: "/#contact", spy: "contact", label: "contact", color: "text-ctp-peach/60", hoverColor: "group-hover:text-ctp-peach", ink: "#ffb84d" },
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
            {links.map(({ href, spy, label, color, hoverColor }, i) => (
                <a
                    key={href}
                    data-spy={spy}
                    className="group flex items-center gap-2 py-1.5 font-mono text-sm text-zinc-200 hover:text-white transition-colors duration-200"
                    href={href}
                >
                    <span className={`${color} ${hoverColor} transition-colors`}>&gt;</span>
                    <span ref={(el) => (labelRefs.current[i] = el)}>{label}</span>
                </a>
            ))}
        </div>
    );
}
