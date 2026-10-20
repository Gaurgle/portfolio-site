import { useEffect, useRef } from "react";
import { sketchOnHover } from "../lib/sketch";

// One-page site: links are smooth Lenis anchor jumps; data-spy drives the
// active state set by the scroll spy in smoothScroll.ts. global.css lights
// the word on hover and while its section is active (.nav-link).
const links = [
    { href: "/#home", spy: "home", label: "Home" },
    { href: "/#about", spy: "about", label: "About" },
    { href: "/#journey", spy: "journey", label: "Journey" },
    { href: "/#projects", spy: "projects", label: "Projects" },
    { href: "/#contact", spy: "contact", label: "Contact" },
];

/** The rough underline's ink: the cloud-shade accent. */
const INK = "rgb(184 197 214)";

export default function SidebarNav() {
    const labelRefs = useRef<Array<HTMLElement | null>>([]);

    useEffect(() => {
        // Hover each link: draw a rough underline, reverse on leave
        const cleanups = labelRefs.current.map((el) =>
            el
                ? sketchOnHover(el, {
                      color: INK,
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
            {links.map(({ href, spy, label }, i) => (
                <a
                    key={href}
                    data-spy={spy}
                    className="nav-link block py-1.5"
                    href={href}
                >
                    <span ref={(el) => (labelRefs.current[i] = el)}>{label}</span>
                </a>
            ))}
        </div>
    );
}
