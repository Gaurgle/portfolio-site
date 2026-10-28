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
/** How quickly the dot follows, s: critically damped, so it tracks the
 *  scroll closely and glides, without overshoot, when a link jumps the page. */
const RESPONSE = 0.2;

export default function SidebarNav() {
    const labelRefs = useRef<Array<HTMLElement | null>>([]);
    const linkRefs = useRef<Array<HTMLAnchorElement | null>>([]);
    const dotRef = useRef<HTMLSpanElement>(null);

    // The reader's progress: a dot beside the links. It rests by a link for
    // as long as that chapter fills the screen, from the chapter's top (where
    // its link scrolls to) until the next chapter starts to come in, and
    // travels to the next link while it does. Home rests from the top of the
    // page, Contact once its panel is half revealed. The dot follows that
    // position on a spring, so a jump across the page reads as travel.
    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 1024px)");
        const spring = { x: NaN, v: 0, target: 0 };
        let scheduled = 0;
        let running = 0;
        let last = 0;
        const ruler = document.createElement("canvas").getContext("2d");

        // Where a link's word stands: the middle of its capitals, which sit
        // above the middle of the line box.
        const capMiddle = (link: HTMLAnchorElement): number => {
            const label = link.firstElementChild as HTMLElement | null;
            const box = link.offsetParent?.getBoundingClientRect();
            if (!label || !box || !ruler) return link.offsetTop + link.offsetHeight / 2;
            const style = getComputedStyle(label);
            ruler.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
            const cap = ruler.measureText("H");
            const baseline = label.getBoundingClientRect().top + cap.fontBoundingBoxAscent;
            return baseline - cap.actualBoundingBoxAscent / 2 - box.top;
        };

        const targetFor = (y: number): number | null => {
            const links = linkRefs.current.filter((l): l is HTMLAnchorElement => !!l);
            if (!links.length) return null;
            const vh = document.documentElement.clientHeight;
            const max = Math.max(1, document.documentElement.scrollHeight - vh);
            // Per link: the scroll range it rests over, and where it stands.
            const zones = links.map((link) => {
                const spy = link.dataset.spy;
                const at = capMiddle(link);
                if (spy === "contact") return { from: max - vh * 0.44, to: max, at };
                const section = document.getElementById(spy ?? "");
                if (!section) return { from: 0, to: 0, at };
                const r = section.getBoundingClientRect();
                const top = spy === "home" ? 0 : r.top + y;
                return { from: top, to: Math.max(top, r.bottom + y - vh), at };
            });
            for (let i = 1; i < zones.length; i++) {
                zones[i].from = Math.max(zones[i].from, zones[i - 1].to);
                zones[i].to = Math.max(zones[i].to, zones[i].from);
            }
            if (y <= zones[0].to) return zones[0].at;
            for (let i = 1; i < zones.length; i++) {
                const prev = zones[i - 1], zone = zones[i];
                if (y < zone.from) {
                    const t = (y - prev.to) / Math.max(1, zone.from - prev.to);
                    const eased = t * t * (3 - 2 * t);
                    return prev.at + (zone.at - prev.at) * eased;
                }
                if (y <= zone.to) return zone.at;
            }
            return zones[zones.length - 1].at;
        };

        const draw = () => {
            const dot = dotRef.current;
            if (!dot) return;
            dot.style.transform = `translate3d(0, ${spring.x.toFixed(1)}px, 0)`;
            dot.classList.add("is-placed");
        };

        const step = (now: number) => {
            const dt = Math.min(1 / 30, (now - last) / 1000);
            last = now;
            // The critically damped spring solved exactly over the frame, so
            // a long frame can't make it overshoot.
            const omega = (2 * Math.PI) / RESPONSE;
            const offset = spring.x - spring.target;
            const decay = Math.exp(-omega * dt);
            const lean = (spring.v + omega * offset) * dt;
            spring.x = spring.target + (offset + lean) * decay;
            spring.v = (spring.v - omega * lean) * decay;
            if (Math.abs(spring.x - spring.target) < 0.1 && Math.abs(spring.v) < 1) {
                spring.x = spring.target;
                spring.v = 0;
                running = 0;
            } else {
                running = requestAnimationFrame(step);
            }
            draw();
        };

        const update = () => {
            scheduled = 0;
            if (!desktop.matches) return;
            const target = targetFor(window.scrollY);
            if (target === null) return;
            spring.target = target;
            if (Number.isNaN(spring.x)) {
                spring.x = target;
                draw();
                return;
            }
            if (!running) {
                last = performance.now();
                running = requestAnimationFrame(step);
            }
        };
        const schedule = () => (scheduled ||= requestAnimationFrame(update));
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        desktop.addEventListener("change", schedule);
        update();
        return () => {
            cancelAnimationFrame(scheduled);
            cancelAnimationFrame(running);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            desktop.removeEventListener("change", schedule);
        };
    }, []);

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
        <div className="relative space-y-1">
            <span ref={dotRef} className="nav-dot" aria-hidden="true" />
            {links.map(({ href, spy, label }, i) => (
                <a
                    key={href}
                    ref={(el) => (linkRefs.current[i] = el)}
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
