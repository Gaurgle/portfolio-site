import { Fragment, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal, flushSync } from "react-dom";
import { lightboxPair, swapShot } from "../lib/shotTransition";
import { projects } from "../data/projects";
import { imageSize } from "../data/imageSizes";
import { ProjectCard, Lightbox } from "./CardProjects";

type Project = (typeof projects)[number];

/** First impressions first: finished projects with screenshots lead, bare
 *  or under-construction ones close the set (order within a tier holds). */
function presentability(p: Project): number {
    const hasShot = Array.isArray(p.image) ? p.image.length > 0 : Boolean(p.image);
    return (hasShot ? 0 : 1) + (p.wip ? 2 : 0);
}

const firstImage = (p: Project) =>
    (Array.isArray(p.image) ? p.image[0] : p.image) || null;

/** The rest of the projects (flagships live in the FeaturedShowcase above).
 *  Desktop: a directory listing - monospace rows, a docked screenshot
 *  viewer, and tech filter chips. Mobile: the native swipe carousel. */
/** The project that leads the listing, and so opens in the viewer. */
const LEAD = "pinz";

/** Height of one listing row: py-4, a text-lg line and its 1px border. */
const ROW_HEIGHT = "(3.75rem + 1px)";
/** The viewer frame never reaches past this many rows (through noiz-kmp),
 *  so the description sits up beside the listing on wide screens too. */
const PREVIEW_ROWS = 10;
/** The frame's shape is the screenshots' own (terminal captures, ~16:10),
 *  so a picture fills it instead of leaving dead air above the copy. Its
 *  height is rounded down to whole rows, so its bottom edge lies on a row's
 *  line. An explicit height (cqw: the viewer column is the container), not
 *  aspect-ratio: WebKit leaves the img's max-height: 100% unresolved
 *  against an aspect-ratio height. */
const viewerFrame = {
    height: `min(round(down, 100cqw * 936 / 1521 - 1px, ${ROW_HEIGHT}) + 1px, ${PREVIEW_ROWS} * ${ROW_HEIGHT} + 1px)`,
};

export default function ProjectsGrid() {
    const rest = projects
        .filter((p) => !("featured" in p) || !p.featured)
        .sort((a, b) =>
            Number(b.projectTitle === LEAD) - Number(a.projectTitle === LEAD) ||
            presentability(a) - presentability(b));

    // The desktop preview opens full size on click, same lightbox the mobile
    // cards use, so every project picture on the page expands.
    const [lightboxOpen, setLightboxOpen] = useState(false);
    // The viewer's picture grows into the lightbox and goes back on close.
    const viewerShotRef = useRef<HTMLImageElement>(null);
    const openLightbox = () => swapShot({ shot: viewerShotRef.current }, () => {
        flushSync(() => setLightboxOpen(true));
        return lightboxPair();
    });
    const closeLightbox = () => swapShot(lightboxPair(), () => {
        flushSync(() => setLightboxOpen(false));
        return { shot: viewerShotRef.current };
    });

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
            countRef.current.textContent = String(i);
        }
    };

    /* ------------------------- desktop ls list ------------------------- */
    const [filter, setFilter] = useState<string | null>(null);
    const [active, setActive] = useState<Project | null>(null);
    // Which way the viewer's picture arrives: from below when the pick is
    // further down the list than the one shown, from above when it is up.
    const [arriveFrom, setArriveFrom] = useState(0);
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

    // The docked viewer always has a project in focus: the clicked row, or
    // the first listed one until then and whenever a filter hides the pick
    // (rows never navigate - only the arrow links out). Only a filter with
    // no matches leaves it on the resting statement.
    const shown = active && listed.includes(active) ? active : listed[0] ?? null;
    const pick = (p: Project) => {
        if (shown && p !== shown) {
            setArriveFrom(Math.sign(listed.indexOf(p) - listed.indexOf(shown)) * 18);
        }
        setActive(p);
        setLightboxOpen(false);
    };

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
                <div className="flex flex-wrap gap-x-6 gap-y-2 mb-6">
                    {chips.map((tag) => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => setFilter(filter === tag ? null : tag)}
                            aria-pressed={filter === tag}
                            className={`press filter-tag text-sm ${filter === tag ? "is-on" : ""}`}
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                <div className="flex" onMouseEnter={warmImages}>
                    {/* Rows. They run up to the viewer, so the open row's
                        pane meets the picture; the gap lives in their right
                        padding instead. Fixed min-height: filtering must not shrink the
                        page (a shorter document would drop the reader into
                        the contact reveal band mid-interaction). */}
                    {/* No data-lens here: the open row's pane inverts the
                        closing cloud behind it (global.css, .ls-row), and
                        it needs that cloud at full brightness to invert. */}
                    <div
                        className="flex-1 border-t border-zinc-800/70 self-start"
                        style={{ minHeight: `${rest.length * 3.75}rem` }}
                    >
                        {listed.length === 0 && (
                            <div className="py-6 px-2 text-sm text-zinc-500">
                                No projects match
                            </div>
                        )}
                        {listed.map((p) => {
                            const href = p.link && p.link !== "#" ? p.link : null;
                            const selected = shown === p;
                            return (
                                <div
                                    key={p.projectTitle}
                                    onClick={() => pick(p)}
                                    onKeyDown={(e) => { if (e.key === "Enter") pick(p); }}
                                    role="button"
                                    tabIndex={0}
                                    className={`ls-row group flex items-baseline gap-5 py-4 pl-2 pr-12 border-b border-zinc-800/70
                                               cursor-pointer
                                               ${selected ? "ls-row-active bg-white/[0.03]" : ""}`}
                                >
                                    <span className="ls-name whitespace-nowrap text-lg text-zinc-200 transition-colors duration-200">
                                        {p.projectTitle}
                                    </span>
                                    <span className="ml-auto" aria-hidden="true"></span>
                                    {/* Right-aligned beside the fixed-width link
                                        cell, so the notes line up down the list. */}
                                    {p.wip && <span className="wip-note shrink-0 self-center">In progress</span>}
                                    {href ? (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            aria-label={`${p.projectTitle} on GitHub`}
                                            className="w-5 text-zinc-300 hover:text-white transition-colors duration-200 shrink-0"
                                        >
                                            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor"
                                                 strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                                <path d="M7 17 17 7M8 7h9v9" />
                                            </svg>
                                        </a>
                                    ) : (
                                        <span className="w-5 text-center text-zinc-700 shrink-0">·</span>
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
                    <div className="w-[clamp(34rem,46%,64rem)] shrink-0 relative flex flex-col [container-type:inline-size]">
                        {shown && (
                            <p className="absolute bottom-full left-0 mb-1 text-base text-white">
                                {shown.projectTitle}
                            </p>
                        )}
                        {!shown ? (
                            <div style={viewerFrame} className="w-full flex flex-col justify-end p-8 bg-zinc-900/20 border border-zinc-800 rounded-md">
                                <p className="text-3xl font-bold leading-tight text-white/90 mb-4">
                                    {rest.length} more
                                    <br />
                                    projects.
                                </p>
                                <p className="text-sm text-zinc-500">
                                    Click a row to open it here
                                </p>
                            </div>
                        ) : firstImage(shown) ? (
                            <button
                                type="button"
                                aria-label={`Open ${shown.projectTitle} screenshots`}
                                onClick={openLightbox}
                                style={viewerFrame}
                                className="block w-full cursor-zoom-in"
                            >
                                {/* Scaled whole to fit the frame, never
                                    stretched; a narrower shot keeps to the
                                    left edge, in line with the copy. */}
                                <img
                                    ref={viewerShotRef}
                                    key={shown.projectTitle}
                                    src={firstImage(shown)!}
                                    {...imageSize(firstImage(shown)!)}
                                    alt=""
                                    decoding="async"
                                    style={{ "--from": `${arriveFrom}px` } as CSSProperties}
                                    className="block w-auto h-auto max-w-full max-h-full rounded-md animate-shot-in cursor-zoom-in"
                                />
                            </button>
                        ) : (
                            <div style={viewerFrame} className="w-full flex items-center justify-center bg-zinc-900/30 border border-zinc-800 rounded-md text-sm text-zinc-500">
                                <span>No preview yet</span>
                            </div>
                        )}
                        {shown && (
                            <div className="flex-none mt-3 h-64 overflow-hidden space-y-2 pl-5">
                                <p className="text-base 2xl:text-lg text-zinc-300 leading-relaxed line-clamp-6">
                                    {shown.description}
                                </p>
                                {/* Each tag holds together with the comma after it, so a
                                    long list wraps between tags, never inside one or
                                    before a comma. */}
                                <p className="text-sm text-zinc-400">
                                    {(shown.tags ?? []).map((tag, i, all) => (
                                        <Fragment key={tag}>
                                            <span className="whitespace-nowrap">
                                                {tag}{i < all.length - 1 && ","}
                                            </span>{" "}
                                        </Fragment>
                                    ))}
                                </p>
                                <div className="flex items-center gap-5 pt-1 text-sm">
                                    {shown.link && shown.link !== "#" && (
                                        <a href={shown.link} target="_blank" rel="noopener noreferrer"
                                           className="text-link">
                                            Source on GitHub
                                        </a>
                                    )}
                                    {shown.demoUrl && (
                                        <a href={shown.demoUrl} target="_blank" rel="noopener noreferrer"
                                           className="text-link">
                                            Visit site
                                        </a>
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
                    onClose={closeLightbox}
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
                    <span className="text-xs text-zinc-400 tabular-nums select-none">
                        <span ref={countRef}>1</span>
                        <span className="text-zinc-500"> of {rest.length}</span>
                    </span>
                    <div className="flex-1 h-0.5 rounded bg-zinc-800 overflow-hidden">
                        <div ref={barRef} className="carousel-progress-bar" />
                    </div>
                    <span className="text-xs text-zinc-400 select-none">
                        Swipe for more
                    </span>
                </div>
            </div>
        </div>
    );
}
