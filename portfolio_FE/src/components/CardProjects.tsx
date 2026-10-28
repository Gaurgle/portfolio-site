import React, {Fragment, useEffect, useRef, useState} from "react";
import {createPortal, flushSync} from "react-dom";
import {lightboxPair, swapShot} from "../lib/shotTransition";
import {fitLines} from "../lib/fitLines";
import {projects} from "../data/projects.ts";
import {imageSize} from "../data/imageSizes.ts";

export function Lightbox({images, startIndex, title, onClose}: {
    images: string[];
    startIndex: number;
    title: string;
    onClose: () => void;
}) {
    const hasMultiple = images.length > 1;
    const [currentIndex, setCurrentIndex] = useState(startIndex);
    const frameRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    const goNext = () => {
        setCurrentIndex(prev => (prev + 1) % images.length);
    };

    const goPrev = () => {
        setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
    };

    // The opener stays focused underneath the overlay; focus moves into the
    // dialog on open and comes back here on close.
    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        closeRef.current?.focus();
        return () => opener?.focus();
    }, []);

    useEffect(() => {
        /** Every control in the dialog is a button, so this is the tab ring. */
        const trapTab = (e: KeyboardEvent) => {
            const frame = frameRef.current;
            if (!frame) return;
            const items = Array.from(frame.querySelectorAll("button"));
            if (!items.length) return;
            const edge = e.shiftKey ? items[0] : items[items.length - 1];
            const wrap = e.shiftKey ? items[items.length - 1] : items[0];
            const active = document.activeElement;
            if (active === edge || !frame.contains(active)) {
                e.preventDefault();
                wrap.focus();
            }
        };

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Tab") trapTab(e);
            if (hasMultiple && e.key === "ArrowRight") goNext();
            if (hasMultiple && e.key === "ArrowLeft") goPrev();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose, hasMultiple]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            data-shot-scrim=""
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                ref={frameRef}
                className="shot-pane"
                onClick={e => e.stopPropagation()}
            >
                <div className="terminal-bar">
                    <span>{title}</span>
                    <button ref={closeRef} type="button" onClick={onClose} className="pane-close" aria-label="Close screenshots"/>
                </div>

                {/* Image area */}
                <div className="relative">
                    {images.map((src, i) => (
                        <img
                            key={src}
                            src={src}
                            {...imageSize(src)}
                            alt={`${title} screenshot${hasMultiple ? ` ${i + 1}` : ""}`}
                            decoding="async"
                            data-shot={i === currentIndex ? "" : undefined}
                            className={`w-full max-h-[75vh] object-contain transition-opacity duration-700
                                       ${i === currentIndex ? "opacity-100" : "opacity-0 absolute inset-0"}`}
                        />
                    ))}

                    {hasMultiple && (
                        <>
                            <button
                                onClick={goPrev}
                                aria-label="Previous screenshot"
                                className="shot-step left-2"
                            >
                                &#8249;
                            </button>
                            <button
                                onClick={goNext}
                                aria-label="Next screenshot"
                                className="shot-step right-2"
                            >
                                &#8250;
                            </button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                                {images.map((_, i) => (
                                    <span
                                        key={i}
                                        className={`shot-tick ${i === currentIndex ? "is-on" : ""}`}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ProjectCard({project, idx}: { project: (typeof projects)[number]; idx: number }) {
    const images = (Array.isArray(project.image) ? project.image : [project.image]).filter(Boolean);
    const hasImage = images.length > 0;
    const hasMultiple = images.length > 1;
    const [currentIndex, setCurrentIndex] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const shotsRef = useRef<HTMLButtonElement>(null);
    const descBoxRef = useRef<HTMLDivElement>(null);
    const descRef = useRef<HTMLParagraphElement>(null);
    // The shown picture grows into the lightbox and goes back on close.
    const cardShot = () => shotsRef.current?.querySelectorAll("img")[currentIndex] ?? null;
    const openLightbox = () => swapShot({shot: cardShot()}, () => {
        flushSync(() => setLightboxOpen(true));
        return lightboxPair();
    });
    const closeLightbox = () => swapShot(lightboxPair(), () => {
        flushSync(() => setLightboxOpen(false));
        return {shot: cardShot()};
    });

    const handleMouseEnter = () => {
        if (!hasMultiple) return;
        intervalRef.current = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % images.length);
        }, 4000);
    };

    const handleMouseLeave = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setCurrentIndex(0);
    };

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // The card has a fixed height: the description gives up whole lines
    // rather than scrolling inside it.
    useEffect(() => {
        if (!descRef.current || !descBoxRef.current) return;
        return fitLines(descRef.current, descBoxRef.current, 12);
    }, []);

    return (
        <div
            className="press relative group w-full h-full bg-[rgb(8_8_11_/_0.9)] border border-zinc-700 rounded-xl overflow-hidden
                       opacity-0 animate-fade-up flex flex-col"
            style={{animationDelay: `${idx * 100 + 100}ms`}}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Image slideshow / placeholder */}
            {hasImage ? (
                <button
                    type="button"
                    aria-label={`Open ${project.projectTitle} screenshots`}
                    className="h-44 w-full overflow-hidden flex-shrink-0 relative cursor-zoom-in text-left"
                    ref={shotsRef}
                    onClick={openLightbox}
                >
                    {images.map((src, i) => (
                        <img
                            key={src}
                            src={src}
                            {...imageSize(src)}
                            alt={`${project.projectTitle} screenshot${hasMultiple ? ` ${i + 1}` : ""}`}
                            loading="lazy"
                            decoding="async"
                            className={`absolute inset-0 h-full w-full object-contain transition-all duration-700
                                       md:group-hover:scale-105
                                       ${i === currentIndex ? "opacity-100" : "opacity-0"}`}
                        />
                    ))}

                    {hasMultiple && (
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                            {images.map((_, i) => (
                                <span
                                    key={i}
                                    className={`block w-1.5 h-1.5 rounded-full transition-all duration-300
                                               ${i === currentIndex ? "bg-white/90 scale-110" : "bg-white/30"}`}
                                />
                            ))}
                        </div>
                    )}
                </button>
            ) : (
                <div className="h-44 w-full flex-shrink-0 relative flex items-center justify-center
                                bg-zinc-900/30 border-b border-zinc-800/50 overflow-hidden select-none">
                    <div className="text-sm text-zinc-600 text-center leading-relaxed">
                        <span className="text-zinc-500">No preview yet</span>
                    </div>
                </div>
            )}

            {lightboxOpen && hasImage && createPortal(
                <Lightbox
                    images={images}
                    startIndex={currentIndex}
                    title={project.projectTitle}
                    onClose={closeLightbox}
                />,
                document.body
            )}

            {project.wip && (
                <span className="wip-note wip-note-over absolute top-3 right-3 z-20">In progress</span>
            )}

            {/* Content: title below the image (editorial order), info + links */}
            <div className="p-5 flex flex-col gap-3 flex-1 min-h-0">
                <h3 className="text-lg font-bold leading-tight text-white">
                    {project.projectTitle}
                </h3>
                <div
                    ref={descBoxRef}
                    className="flex-1 min-h-0 overflow-hidden text-[15px] text-zinc-400 leading-relaxed"
                >
                    <p ref={descRef} className="fit-lines">{project.description}</p>
                </div>

                {project.tags && (
                    <p className="text-[13px] text-zinc-400">
                        {project.tags.map((tag: string, i: number, all: string[]) => (
                            <Fragment key={tag}>
                                <span className="whitespace-nowrap">
                                    {tag}{i < all.length - 1 && ","}
                                </span>{" "}
                            </Fragment>
                        ))}
                    </p>
                )}

                {/* Links */}
                <div className="flex gap-3 pt-2 min-h-[2.5rem]">
                    {project.demoUrl && (
                        <a
                            href={project.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-link text-sm"
                        >
                            Visit site
                        </a>
                    )}
                    {project.link && project.link !== "#" && (
                        <a
                            href={project.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-link text-sm"
                        >
                            Source on GitHub
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
