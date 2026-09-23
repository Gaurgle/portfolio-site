import { useRef } from "react";
import { stack, lerpColor } from "./TechStack";

/**
 * Infinite devicon marquee - now THE tech stack presence on the site. The
 * track holds the icon set twice; the scroll engine (smoothScroll.ts)
 * translates it every frame, drifting when idle and accelerating/skewing
 * with scroll velocity, wrapping at the halfway point.
 *
 * Carries the cursor-follow glow from the old about-page stack card: a soft
 * Catppuccin-tinted blob trails the pointer across the band.
 */
export default function TechMarquee() {
    const items = [...stack, ...stack];
    const blobRef = useRef<HTMLDivElement>(null);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const blob = blobRef.current;
        if (!blob) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const rgb = lerpColor(x / rect.width);
        blob.style.left = `${x}px`;
        blob.style.top = "50%";
        blob.style.opacity = "0.55";
        blob.style.animationPlayState = "running";
        blob.style.background =
            `radial-gradient(ellipse at 40% 45%, rgba(${rgb},0.5) 0%, rgba(${rgb},0.15) 35%, transparent 60%)`;
    };

    const onLeave = () => {
        if (blobRef.current) blobRef.current.style.opacity = "0";
    };

    // The morph animates border-radius, which the browser repaints on the
    // main thread every frame. Held still once the blob has faded out, and
    // picked up where it stopped on the next pass, so it is never seen still.
    const onFaded = (e: React.TransitionEvent<HTMLDivElement>) => {
        if (e.propertyName === "opacity" && e.currentTarget.style.opacity === "0") {
            e.currentTarget.style.animationPlayState = "paused";
        }
    };

    return (
        <div className="tech-marquee relative" aria-hidden="true" onMouseMove={onMove} onMouseLeave={onLeave}>
            <div ref={blobRef} className="icon-blob" style={{ animationPlayState: "paused" }} onTransitionEnd={onFaded} />
            <div data-marquee-track>
                {items.map(({ icon: Icon, name, mono }, i) => (
                    <div key={`${name}-${i}`} className="group relative z-10 flex items-center gap-3 cursor-default">
                        <Icon
                            className={
                                mono
                                    ? "w-14 h-14 text-zinc-600 group-hover:text-white transition-all duration-300"
                                    : "w-14 h-14 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300"
                            }
                        />
                        <span className="font-mono text-base text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
                            {name}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
