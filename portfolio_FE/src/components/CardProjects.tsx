import React, {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import BorderBeam from "./HibubbaIO/BorderBeam.tsx";
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label={title}
        >
            <div
                ref={frameRef}
                className="relative w-[85vw] max-w-5xl bg-zinc-950 border border-zinc-700/60 rounded-xl
                           shadow-2xl shadow-black/50 overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Terminal bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800">
                    <button ref={closeRef} type="button" onClick={onClose} className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-400 transition-colors" aria-label="Close"/>
                    <span className="w-3 h-3 rounded-full bg-yellow-500/80"/>
                    <span className="w-3 h-3 rounded-full bg-green-500/80"/>
                    <span className="ml-3 font-mono text-xs text-zinc-400">{title}</span>
                </div>

                {/* Image area */}
                <div className="relative">
                    {images.map((src, i) => (
                        <img
                            key={src}
                            src={src}
                            {...imageSize(src)}
                            alt={`${title}${hasMultiple ? ` slide ${i + 1}` : ""}`}
                            decoding="async"
                            className={`w-full max-h-[75vh] object-contain transition-opacity duration-700
                                       ${i === currentIndex ? "opacity-100" : "opacity-0 absolute inset-0"}`}
                        />
                    ))}

                    {hasMultiple && (
                        <>
                            <button
                                onClick={goPrev}
                                aria-label="Previous image"
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center
                                           rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white
                                           transition-all duration-200 text-2xl"
                            >
                                &#8249;
                            </button>
                            <button
                                onClick={goNext}
                                aria-label="Next image"
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center
                                           rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white
                                           transition-all duration-200 text-2xl"
                            >
                                &#8250;
                            </button>
                            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                                {images.map((_, i) => (
                                    <span
                                        key={i}
                                        className={`block w-2 h-2 rounded-full transition-all duration-300
                                                   ${i === currentIndex ? "bg-white/90 scale-110" : "bg-white/30"}`}
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

    return (
        <div
            className="relative group w-full h-full bg-zinc-950 border border-zinc-700/70 rounded-md overflow-hidden
                       transition-colors duration-500
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
                    onClick={() => setLightboxOpen(true)}
                >
                    {images.map((src, i) => (
                        <img
                            key={src}
                            src={src}
                            {...imageSize(src)}
                            alt={`${project.projectTitle}${hasMultiple ? ` slide ${i + 1}` : ""}`}
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
                    <div className="font-mono text-xs text-zinc-600 text-center leading-relaxed">
                        <span className="text-ctp-mauve">$</span> ./preview
                        <br />
                        <span className="text-zinc-700">no screenshot yet</span>
                    </div>
                </div>
            )}

            {lightboxOpen && hasImage && createPortal(
                <Lightbox
                    images={images}
                    startIndex={currentIndex}
                    title={project.projectTitle}
                    onClose={() => setLightboxOpen(false)}
                />,
                document.body
            )}

            {project.wip && (
                <span className="absolute top-2 left-2 z-20 px-2 py-0.5 text-[10px] font-mono
                                 bg-ctp-yellow/15 text-ctp-yellow border border-ctp-yellow/30">
                    under construction
                </span>
            )}

            {/* Content: title below the image (editorial order), info + links */}
            <div className="p-5 flex flex-col gap-3 flex-1 min-h-0">
                <h3 className="text-lg font-bold leading-tight text-white">
                    {project.projectTitle}
                </h3>
                <div
                    className="flex-1 min-h-0 overflow-hidden text-xs text-zinc-400 leading-relaxed
                               [mask-image:linear-gradient(to_bottom,black_85%,transparent)]"
                >
                    <p>{project.description}</p>
                </div>

                {project.tags && (
                    <div className="flex flex-wrap-reverse gap-1.5">
                        {project.tags.map((tag: string) => (
                            <span
                                key={tag}
                                className="px-2 py-0.5 text-[10px] font-mono
                                           bg-zinc-800/80 text-zinc-400 border border-zinc-800"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                )}

                {/* Links */}
                <div className="flex gap-3 pt-3 border-t border-zinc-800/50 min-h-[2.5rem]">
                    {project.demoUrl && (
                        <a
                            href={project.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-zinc-400 hover:text-white transition-colors duration-200"
                        >
                            live &rarr;
                        </a>
                    )}
                    {project.link && project.link !== "#" && (
                        <a
                            href={project.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs text-zinc-400 hover:text-white transition-colors duration-200"
                        >
                            github &rarr;
                        </a>
                    )}
                </div>
            </div>

            <BorderBeam className="rounded-xl z-10"/>
        </div>
    );
}

