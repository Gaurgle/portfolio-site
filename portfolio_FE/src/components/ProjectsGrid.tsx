import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { projects } from "../data/projects";
import { ProjectCard, Lightbox } from "./CardProjects";
import PlayButton from "./PlayButton";

type Project = (typeof projects)[number];

/** First impressions first: finished projects with screenshots lead, bare
 *  or under-construction ones close the set (order within a tier holds). */
function presentability(p: Project): number {
    const hasShot = Array.isArray(p.image) ? p.image.length > 0 : Boolean(p.image);
    return (hasShot ? 0 : 1) + (p.wip ? 2 : 0);
}

const firstImage = (p: Project) =>
    (Array.isArray(p.image) ? p.image[0] : p.image) || null;

/** Catppuccin accent per row, cycled. */
const ACCENTS = ["#a6e3a1", "#89b4fa", "#cba6f7", "#fab387", "#94e2d5", "#f5c2e7"];

/** The rest of the projects (flagships live in the FeaturedShowcase above).
 *  Desktop: a terminal directory listing - monospace rows, a floating
 *  screenshot preview that trails the cursor, and tech filter chips that
 *  read as a grep pipe. Mobile: the native swipe carousel. */
export default function ProjectsGrid() {
    const rest = projects
        .filter((p) => !("featured" in p) || !p.featured)
        .sort((a, b) => presentability(a) - presentability(b));

    // The desktop preview opens full size on click, same lightbox the mobile
    // cards use, so every project picture on the page expands.
    const [lightboxOpen, setLightboxOpen] = useState(false);

    /* ------------------------- mobile carousel ------------------------- */
    const trackRef = useRef<HTMLDivElement>(null);
    const barRef = useRef<HTMLDivElement>(null);
    const countRef = useRef<HTMLSpanElement>(null);

    const onTrackScroll = () => {
        const track = trackRef.current;
        if (!track) return;
        const max = track.scrollWidth - track.clientWidth;
        const t = max > 0 ? track.scrollLeft / max : 0;
        if (barRef.current) barRef.current.style.transform = `scaleX(${t})`;
        if (countRef.current) {
            const i = Math.round(t * (rest.length - 1)) + 1;
            countRef.current.textContent = String(i).padStart(2, "0");
        }
    };

    // One-time nudge: the track slides out and settles back when the
    // section first appears, so the sideways axis announces itself.
    useEffect(() => {
        const track = trackRef.current;
        if (!track) return;
        if (window.matchMedia("(min-width: 768px)").matches) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    io.disconnect();
                    if (track.scrollLeft > 0) return;
                    // Transform, not scrollLeft: snap-mandatory containers
                    // yank programmatic scrolls straight back.
                    track.style.transition =
                        "transform 0.45s cubic-bezier(0.25, 1, 0.5, 1)";
                    track.style.transform = "translateX(-72px)";
                    window.setTimeout(() => {
                        track.style.transform = "";
                        window.setTimeout(() => (track.style.transition = ""), 500);
                    }, 550);
                }
            },
            { threshold: 0.4 },
        );
        io.observe(track);
        return () => io.disconnect();
    }, []);

    /* ------------------------- desktop ls list ------------------------- */
    const [filter, setFilter] = useState<string | null>(null);
    const [active, setActive] = useState<Project | null>(null);
    const warmedRef = useRef(false);

    // Curated filter set, matched loosely against tags (case-insensitive
    // substring: "CLI" also catches "GitHub CLI").
    const chips = ["BLE", "LE Audio", "Kotlin", "Android", "Audio", "CLI", "Java"];

    const listed = filter
        ? rest.filter((p) =>
              (p.tags ?? []).some((t) =>
                  t.toLowerCase().includes(filter.toLowerCase()),
              ),
          )
        : rest;

    // The docked viewer engages on CLICK (rows never navigate - only the
    // arrow links out). Until the first click it shows a statement.
    const shown = active && listed.includes(active) ? active : null;

    // Warm every preview image into cache once, so row-to-row swaps don't
    // stall on network + decode.
    const warmImages = () => {
        if (warmedRef.current) return;
        warmedRef.current = true;
        for (const proj of rest) {
            const src = firstImage(proj);
            if (src) new Image().src = src;
        }
    };

    return (
        <div>
            {/* ==================== desktop: ls listing ==================== */}
            <div className="hidden lg:block">
                <p className="font-mono text-sm text-zinc-400 mb-1">
                    <span className="text-ctp-blue">$</span> ls projects/
                    {filter && (
                        <span className="text-zinc-500">
                            {" "}| grep <span className="text-ctp-blue">{filter.toLowerCase()}</span>
                        </span>
                    )}
                    <span className="text-zinc-600 select-none">  # click a row to preview</span>
                </p>
                <div className="flex flex-wrap gap-1.5 mb-6">
                    {chips.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => setFilter(filter === tag ? null : tag)}
                            className={`px-2.5 py-0.5 text-[11px] font-mono rounded-sm border transition-colors duration-200
                                ${filter === tag
                                    ? "bg-ctp-blue/15 text-ctp-blue border-ctp-blue/40"
                                    : "bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200"}`}
                        >
                            {tag.toLowerCase()}
                        </button>
                    ))}
                </div>

                <div className="flex gap-10" onMouseEnter={warmImages}>
                    {/* Rows. Fixed min-height: filtering must not shrink the
                        page (a shorter document would drop the reader into
                        the contact reveal band mid-interaction). */}
                    <div
                        className="flex-1 border-t border-zinc-800/70 self-start"
                        style={{ minHeight: `${rest.length * 3.75}rem` }}
                    >
                        {listed.length === 0 && (
                            <div className="py-6 px-2 font-mono text-sm text-zinc-500">
                                grep: no matches in projects/
                            </div>
                        )}
                        {listed.map((p, i) => {
                            const accent = ACCENTS[i % ACCENTS.length];
                            const href = p.link && p.link !== "#" ? p.link : null;
                            const selected = shown === p;
                            return (
                                <div
                                    key={p.projectTitle}
                                    onClick={() => { setActive(p); setLightboxOpen(false); }}
                                    onKeyDown={(e) => { if (e.key === "Enter") { setActive(p); setLightboxOpen(false); } }}
                                    role="button"
                                    tabIndex={0}
                                    style={{ "--rc": accent } as CSSProperties}
                                    className={`ls-row group flex items-baseline gap-5 py-4 px-2 border-b border-zinc-800/70
                                               font-mono cursor-pointer transition-colors duration-200 hover:bg-white/[0.02]
                                               ${selected ? "ls-row-active bg-white/[0.03]" : ""}`}
                                >
                                    <span className="ls-name whitespace-nowrap text-lg text-zinc-200 transition-colors duration-200">
                                        {p.projectTitle.toLowerCase().replaceAll(" ", "-")}
                                    </span>
                                    {p.wip && (
                                        <span className="px-1.5 py-0.5 text-[10px] bg-ctp-yellow/15 text-ctp-yellow border border-ctp-yellow/30 shrink-0 whitespace-nowrap">
                                            under construction
                                        </span>
                                    )}
                                    <span className="ml-auto" aria-hidden="true"></span>
                                    {href ? (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`${p.projectTitle} on GitHub`}
                                            className="text-zinc-600 hover:text-white group-hover:text-zinc-300 transition-colors duration-200 shrink-0"
                                        >
                                            ↗
                                        </a>
                                    ) : (
                                        <span className="text-zinc-700 shrink-0">·</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Docked viewer: frameless - the name floats above the
                        top line, the picture aligns with the rows, info at
                        the bottom. Engages on row click; rests as a
                        statement until then. Set sizes: nothing moves or
                        resizes between projects - only content swaps. */}
                    <div className="w-[34rem] shrink-0 relative flex flex-col">
                        {shown && (
                            <p className="absolute bottom-full left-0 mb-1 font-mono text-base text-white">
                                {shown.projectTitle.toLowerCase().replaceAll(" ", "-")}
                                <span className="text-ctp-blue animate-pulse">_</span>
                            </p>
                        )}
                        {!shown ? (
                            <div className="w-full h-[28rem] flex flex-col justify-end p-8 bg-zinc-900/20 border border-zinc-800 rounded-md">
                                <p className="text-3xl font-bold leading-tight text-white/90 mb-4">
                                    {rest.length} more
                                    <br />
                                    projects<span className="text-ctp-blue">.</span>
                                </p>
                                <p className="font-mono text-xs text-zinc-500">
                                    <span className="text-ctp-blue">$</span> click a row to open it here
                                </p>
                            </div>
                        ) : firstImage(shown) ? (
                            <img
                                key={shown.projectTitle}
                                src={firstImage(shown)!}
                                alt=""
                                decoding="async"
                                onClick={() => setLightboxOpen(true)}
                                className="w-full h-[28rem] object-contain rounded-md animate-fade-in-fast cursor-zoom-in"
                            />
                        ) : (
                            <div className="w-full h-[28rem] flex items-center justify-center bg-zinc-900/30 border border-zinc-800 rounded-md font-mono text-xs text-zinc-600">
                                <span>
                                    <span className="text-ctp-mauve">$</span> ./preview
                                    <br />
                                    no screenshot yet
                                </span>
                            </div>
                        )}
                        {shown && (
                            <div className="flex-none mt-3 h-48 overflow-hidden space-y-2">
                                <p className="text-sm text-zinc-400 leading-relaxed line-clamp-6">
                                    {shown.description}
                                </p>
                                <p className="font-mono text-xs text-zinc-500 truncate">
                                    {(shown.tags ?? []).join(" · ").toLowerCase()}
                                </p>
                                <div className="flex items-center gap-5 pt-1 font-mono text-xs">
                                    {shown.link && shown.link !== "#" && (
                                        <a href={shown.link} target="_blank" rel="noopener noreferrer"
                                           className="text-zinc-400 hover:text-white transition-colors duration-200">
                                            github &rarr;
                                        </a>
                                    )}
                                    {shown.demoUrl && (
                                        <a href={shown.demoUrl} target="_blank" rel="noopener noreferrer"
                                           className="text-zinc-400 hover:text-white transition-colors duration-200">
                                            live &rarr;
                                        </a>
                                    )}
                                    {shown.songSrc && (
                                        <PlayButton src={shown.songSrc} title={shown.projectTitle} />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {lightboxOpen && shown && firstImage(shown) && createPortal(
                <Lightbox
                    images={(Array.isArray(shown.image) ? shown.image : [shown.image]).filter(Boolean) as string[]}
                    startIndex={0}
                    title={shown.projectTitle}
                    onClose={() => setLightboxOpen(false)}
                />,
                document.body,
            )}

            {/* ==================== mobile: swipe carousel ==================== */}
            <div className="lg:hidden">
                <div
                    ref={trackRef}
                    onScroll={onTrackScroll}
                    className="carousel-track flex overflow-x-auto snap-x snap-mandatory gap-4 -mx-8 px-4 pb-2"
                >
                    {rest.map((project, idx) => (
                        <div
                            key={project.projectTitle}
                            className="snap-center shrink-0 w-[78vw] h-[min(35rem,78svh)] flex"
                        >
                            <ProjectCard project={project} idx={idx} />
                        </div>
                    ))}
                </div>

                {/* Swipe indicator: counter + progress bar + hint */}
                <div className="mt-4 flex items-center gap-3 px-1" aria-hidden="true">
                    <span className="font-mono text-[10px] tracking-widest text-zinc-400 select-none">
                        <span ref={countRef}>01</span>
                        <span className="text-zinc-600"> / {String(rest.length).padStart(2, "0")}</span>
                    </span>
                    <div className="flex-1 h-0.5 rounded bg-zinc-800 overflow-hidden">
                        <div ref={barRef} className="carousel-progress-bar" />
                    </div>
                    <span className="font-mono text-[10px] tracking-widest text-zinc-500 select-none">
                        swipe &rarr;
                    </span>
                </div>
            </div>
        </div>
    );
}
