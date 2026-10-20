import Lenis from "lenis";

/**
 * Scroll engine for the one-page "terminal session" site.
 *
 * Owns the Lenis instance, its RAF loop, snap points, and every scroll-driven
 * effect: progress bar, hero dissolve, wrapped particle parallax, relative
 * parallax (ghost numerals), the pinned horizontal journey, the velocity
 * marquee, reveal-on-scroll, and the sidebar scroll spy.
 *
 * Astro's ClientRouter swaps the DOM per navigation, so everything is torn
 * down on `astro:before-swap` and rebuilt on `astro:page-load`.
 */

let lenis: Lenis | null = null;
let rafId = 0;
/** Lenis easing per frame for a mouse wheel: a short glide that smooths the
 *  notches without trailing far behind them. */
const SCROLL_LERP = 0.12;
/** Trackpads already deliver momentum of their own, so their input passes
 *  through nearly 1:1 instead of being smoothed a second time. */
const TRACKPAD_LERP = 1;
/** Peak scroll speed under Lenis, in viewport heights per second, while a
 *  pinned or held stage is in range. Each wheel delta moves a target the
 *  glide chases; with no limit a hard flick queues several screens and the
 *  page tears through the stage, skipping every held moment. Capping how far
 *  the target may run ahead of the glide bounds the speed, since the glide
 *  covers a fixed fraction of that lead per frame. Free-flowing stretches
 *  take every delta as given. Touch scrolling stays browser-owned. */
const MAX_SCROLL_SPEED = 3.5;
/** Anchor jumps longer than this many viewports cross-fade instead of
 *  scrolling through every stage on the way. */
const ANCHOR_FADE_JUMP = 3;
/** True while an anchor-click scroll is in flight (rest behaviours stand down). */
let anchorBypass = false;
/** Document scroll ranges in which a pinned or held stage is on screen (the
 *  speed cap applies across these only). Filled by bindScrollDriven. */
let stageRanges: Array<[number, number]> = [];
/** Per-frame rest snap (focus handovers, contact reveal), set by
 *  bindScrollDriven (needs its measurements); runs from the RAF loop since
 *  rest detection can't live in scroll events. */
let restTick: (() => void) | null = null;
/** Per-frame particle-layer driver (scroll drift + lerped mouse parallax);
 *  lives in the RAF loop because the cursor moves without scroll events. */
let parallaxTick: (() => void) | null = null;
/** Pointer light on type (setupPointerLight): headline rects are read at
 *  the top of the frame, before any scroll write, and lit at its end. */
let lightRead: (() => void) | null = null;
let lightWrite: (() => void) | null = null;
const observers: IntersectionObserver[] = [];
const cleanups: Array<() => void> = [];

const prefersReducedMotion = (): boolean =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Desktop = the sidebar layout. Tablets and landscape phones (768-1023px)
   run the mobile choreography: the pinned side-by-side compositions need
   more width than they have. Must mirror the breakpoints in global.css. */
const isDesktop = (): boolean =>
    window.matchMedia("(min-width: 1024px)").matches;

/** Match the CSS pin height: on phones that is the large viewport (lvh,
 *  the screen with the browser bar hidden), whatever the bar is doing at
 *  the moment of measuring. */
export function measureViewportHeight(): number {
    if (isDesktop()) return window.innerHeight || 1;
    const probe = document.createElement("div");
    probe.style.cssText =
        "position:fixed;top:0;width:0;height:100lvh;visibility:hidden;pointer-events:none";
    document.body.appendChild(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height || window.innerHeight || 1;
}

let layoutViewportH = 1;

function updateViewport(): void {
    layoutViewportH = measureViewportHeight();
}

function nativeProgress(): number {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? el.scrollTop / max : 0;
}

/** True when the scroll between `a` and `b` touches a pinned or held stage. */
function crossesStage(a: number, b: number): boolean {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    return stageRanges.some(([start, end]) => hi >= start && lo <= end);
}

/**
 * Critically damped spring (damping 1.0) as a Lenis easing. `response` is
 * the spring's period in seconds; `velocity` (px/s) seeds it, so motion
 * already under way carries into the spring instead of restarting from
 * rest. Lenis wants a duration, so it is the time the spring needs to come
 * within half a pixel of the target.
 */
function springEase(distance: number, velocity: number, response: number) {
    const omega = (2 * Math.PI) / response;
    const relative = velocity / distance;
    const offset = (t: number) => (1 + (omega - relative) * t) * Math.exp(-omega * t);
    const residual = 0.5 / Math.abs(distance);
    let duration = response;
    while (Math.abs(offset(duration)) > residual && duration < 3) duration += 1 / 60;
    return { duration, easing: (p: number) => 1 - offset(p * duration) };
}

/** Springs the page to `target`. Any wheel input takes over mid-flight:
 *  Lenis starts its glide from wherever the spring has got to. */
function springTo(target: number, response: number, onComplete?: () => void): void {
    if (!lenis) return;
    const distance = target - lenis.animatedScroll;
    if (Math.abs(distance) < 1) {
        onComplete?.();
        return;
    }
    // Lenis reports velocity in pixels per frame.
    const { duration, easing } = springEase(distance, lenis.velocity * 60, response);
    lenis.scrollTo(target, { duration, easing, onComplete });
}

/* ------------------------------------------------------------------ */
/* Reveal on scroll (one-shot)                                         */
/* ------------------------------------------------------------------ */

function setupReveal(): void {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (!els.length) return;

    const io = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                entry.target.classList.add("is-visible");
                io.unobserve(entry.target);
            }
        },
        { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    els.forEach((el) => io.observe(el));
    observers.push(io);
}

/* ------------------------------------------------------------------ */
/* Word reveals                                                        */
/* ------------------------------------------------------------------ */

/**
 * `[data-word-reveal]` text splits into word spans that rise in with a
 * stagger once the surrounding `[data-reveal]` card becomes visible (the
 * reveal IO adds .is-visible; CSS does the rest). Walks text nodes only,
 * so nested markup - like the rough-notation spans - stays intact.
 */
function setupWordReveals(reduced: boolean): void {
    if (reduced) return;
    const els = document.querySelectorAll<HTMLElement>(
        "[data-word-reveal]:not([data-wr-done])",
    );
    for (const el of els) {
        el.setAttribute("data-wr-done", "");
        let wi = 0;
        const walk = (node: Node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                [...node.childNodes].forEach(walk);
                return;
            }
            if (node.nodeType !== Node.TEXT_NODE) return;
            const text = node.textContent ?? "";
            if (!text.trim()) return;
            const frag = document.createDocumentFragment();
            // A text node that opens with punctuation and no leading space is
            // the tail of the element before it: the "." in
            // "<span>IMRSV Music</span>." lives in a separate text node from
            // the name it terminates. Remembered here so it can be tied back
            // to that element once the fragment is in the document.
            const opensWithPunctuation = /^[^\s\p{L}\p{N}]/u.test(text);
            let leadPunctuation: HTMLElement | null = null;

            for (const part of text.split(/(\s+)/)) {
                if (!part) continue;
                if (/^\s+$/.test(part)) {
                    frag.appendChild(document.createTextNode(part));
                } else {
                    const span = document.createElement("span");
                    span.className = "wr-w";
                    // Punctuation stranded by the split - the "." after an
                    // annotated name, the "," between two of them, the "/" in
                    // "Spring Boot/Ktor" - is its own text node and would
                    // otherwise get its own stagger index and rise a beat
                    // after the word it belongs to, reading as a misplaced
                    // mark. Reuse the previous word's index so it travels with
                    // its word instead of trailing it.
                    const isPunctuation = !/[\p{L}\p{N}]/u.test(part);
                    if (isPunctuation && wi > 0) {
                        span.style.setProperty("--wi", String(Math.min(wi - 1, 45)));
                    } else {
                        // Delay cap: very long paragraphs finish together at
                        // the tail instead of dripping in for seconds.
                        span.style.setProperty("--wi", String(Math.min(wi++, 45)));
                    }
                    span.textContent = part;
                    if (isPunctuation && opensWithPunctuation && !frag.firstChild) {
                        leadPunctuation = span;
                    }
                    frag.appendChild(span);
                }
            }

            const parent = node.parentNode;
            parent?.replaceChild(frag, node);

            // Every .wr-w is display:inline-block, and the line breaker allows
            // a break after any atomic inline - so a "." that follows an
            // annotated name can start the next line on its own. Measured: it
            // orphans at ~1% of container widths, which is why it only showed
            // up at one specific viewport. A word joiner does NOT prevent it.
            // Tying the element and its punctuation into a nowrap shell does.
            if (leadPunctuation && parent) {
                // Walk back past any rough-notation overlay: it injects its
                // <svg> as a sibling directly after the word it annotates, so
                // the naive previousSibling is the drawing, not the text.
                let anchor: Node | null = leadPunctuation.previousSibling;
                while (
                    anchor &&
                    anchor.nodeType === Node.ELEMENT_NODE &&
                    (anchor as Element).classList?.contains("rough-annotation")
                ) {
                    anchor = anchor.previousSibling;
                }

                if (anchor && anchor.nodeType === Node.ELEMENT_NODE) {
                    const shell = document.createElement("span");
                    shell.style.whiteSpace = "nowrap";
                    parent.insertBefore(shell, anchor);
                    // Move the whole run, anchor through punctuation, so any
                    // overlay in between keeps its position in the order.
                    let cursor: Node | null = anchor;
                    while (cursor) {
                        const next: Node | null = cursor.nextSibling;
                        shell.appendChild(cursor);
                        if (cursor === leadPunctuation) break;
                        cursor = next;
                    }
                }
            }
        };
        [...el.childNodes].forEach(walk);
    }
}

/* ------------------------------------------------------------------ */
/* Magnetic hover                                                      */
/* ------------------------------------------------------------------ */

/** `[data-magnetic="0.3"]` elements lean toward the cursor while hovered
 *  and spring back on leave. Desktop only - there is no hover on touch. */
function setupMagnetic(reduced: boolean): void {
    if (reduced || !isDesktop()) return;
    for (const el of document.querySelectorAll<HTMLElement>("[data-magnetic]")) {
        const strength = parseFloat(el.dataset.magnetic || "0.3");
        const onMove = (e: MouseEvent) => {
            const r = el.getBoundingClientRect();
            const dx = e.clientX - (r.left + r.width / 2);
            const dy = e.clientY - (r.top + r.height / 2);
            el.style.transition = "transform 0.15s ease-out";
            el.style.transform =
                `translate(${(dx * strength).toFixed(1)}px, ${(dy * strength).toFixed(1)}px)`;
        };
        const onLeave = () => {
            el.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
            el.style.transform = "";
        };
        el.addEventListener("mousemove", onMove);
        el.addEventListener("mouseleave", onLeave);
        cleanups.push(() => {
            el.removeEventListener("mousemove", onMove);
            el.removeEventListener("mouseleave", onLeave);
            el.style.transform = "";
            el.style.transition = "";
        });
    }
}

/* ------------------------------------------------------------------ */
/* Headline light (prism moments)                                      */
/* ------------------------------------------------------------------ */

/**
 * A headline's light has two sources, each its own variable: how settled
 * its chapter stands (--settle, scroll) and how near the pointer is (--lit).
 * global.css draws a soft spectral fringe from both; `has-light` marks the
 * headlines whose fringe layer needs drawing at all.
 */
const lightState = new WeakMap<HTMLElement, { settle: number; lit: number }>();

function setLight(el: HTMLElement, source: "settle" | "lit", value: number): void {
    let state = lightState.get(el);
    if (!state) lightState.set(el, (state = { settle: 0, lit: 0 }));
    const rounded = Math.round(value * 1000) / 1000;
    if (state[source] === rounded) return;
    state[source] = rounded;
    el.style.setProperty(`--${source}`, String(rounded));
    el.classList.toggle("has-light", state.settle > 0 || state.lit > 0);
}

/** How far the pointer's light reaches past a headline's edge, px. */
const LIGHT_REACH = 380;

/**
 * Headlines near the cursor catch its light: --lit (0..1) eases with the
 * distance to the headline's box, and --lx/--ly point from the cursor
 * through the headline, so the fringe falls on its far side. Desktop with a
 * fine pointer only. Nothing is read or written while the pointer, the
 * scroll and every eased value are still.
 */
function setupPointerLight(reduced: boolean): void {
    if (reduced || !isDesktop()) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const heads = Array.from(document.querySelectorAll<HTMLElement>(
        ".chapter-mark, .beam-title, .featured-card h3, .passage-head",
    ));
    if (!heads.length) return;

    const onScreen = new Set<HTMLElement>();
    const io = new IntersectionObserver((entries) => {
        for (const e of entries) {
            const el = e.target as HTMLElement;
            if (e.isIntersecting) onScreen.add(el);
            else onScreen.delete(el);
        }
    });
    heads.forEach((el) => io.observe(el));
    observers.push(io);

    const pointer = { x: -1e4, y: -1e4 };
    const onMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
        pointer.x = e.clientX;
        pointer.y = e.clientY;
    };
    const onLeave = () => (pointer.x = pointer.y = -1e4);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    cleanups.push(() => {
        window.removeEventListener("pointermove", onMove);
        document.documentElement.removeEventListener("pointerleave", onLeave);
        lightRead = lightWrite = null;
    });

    const lit = new Map<HTMLElement, number>();
    /** Per headline: target light and its direction, read but not yet written. */
    const targets = new Map<HTMLElement, [number, number, number]>();
    const directions = new Map<HTMLElement, string>();
    let lastKey = "";
    let easing = false;
    lightRead = () => {
        const key = `${pointer.x},${pointer.y},${window.scrollY}`;
        if (key === lastKey && !easing) return;
        lastKey = key;
        for (const el of heads) {
            const previous = targets.get(el);
            if (!onScreen.has(el)) {
                targets.set(el, [0, previous?.[1] ?? 0, previous?.[2] ?? 0]);
                continue;
            }
            const r = el.getBoundingClientRect();
            const dx = Math.max(r.left - pointer.x, 0, pointer.x - r.right);
            const dy = Math.max(r.top - pointer.y, 0, pointer.y - r.bottom);
            const near = Math.max(0, 1 - Math.hypot(dx, dy) / LIGHT_REACH);
            const cx = r.left + r.width / 2 - pointer.x;
            const cy = r.top + r.height / 2 - pointer.y;
            const length = Math.hypot(cx, cy) || 1;
            targets.set(el, [near * near, cx / length, cy / length]);
        }
    };
    lightWrite = () => {
        easing = false;
        for (const [el, [target, lx, ly]] of targets) {
            const current = lit.get(el) ?? 0;
            const direction = `${lx.toFixed(2)} ${ly.toFixed(2)}`;
            if (target > 0 && directions.get(el) !== direction) {
                directions.set(el, direction);
                el.style.setProperty("--lx", lx.toFixed(2));
                el.style.setProperty("--ly", ly.toFixed(2));
            }
            if (current === target) continue;
            // Eased per frame, so a light that jumps (a fast cursor, a page
            // jump) still fades in and out.
            const next = Math.abs(target - current) < 0.004
                ? target
                : current + (target - current) * 0.14;
            lit.set(el, next);
            setLight(el, "lit", next);
            if (next !== target) easing = true;
        }
    };
}

/* ------------------------------------------------------------------ */
/* Sidebar scroll spy                                                  */
/* ------------------------------------------------------------------ */

function setupScrollSpy(): void {
    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    if (!sections.length) return;

    const hueEl = document.getElementById("bottom-hue");
    let currentActive = "";

    const setActive = (section: HTMLElement) => {
        const name = section.dataset.section ?? "";
        if (name === currentActive) return;
        currentActive = name;
        document.querySelectorAll<HTMLElement>("[data-spy]").forEach((link) => {
            link.classList.toggle("spy-active", link.dataset.spy === name);
        });
        // Lets CSS react to focus (e.g. ghost numerals brightening).
        sections.forEach((s) => s.classList.toggle("section-active", s === section));
        // Named on <html> too, so fixed chrome outside the sections can react
        // (the header socials give way to the contact chapter's own links).
        document.documentElement.dataset.section = name;
        // The bottom hue adopts the chapter's accent (CSS cross-fades it);
        // the hero alone stays hue-free.
        if (hueEl) {
            if (section.dataset.hue) {
                hueEl.style.setProperty("--hue-color", section.dataset.hue);
            }
            hueEl.classList.toggle("hue-off", name === "home");
        }
    };

    const io = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                setActive(entry.target as HTMLElement);
            }
        },
        // A narrow band around the viewport center decides the active section.
        { rootMargin: "-40% 0px -50% 0px" },
    );

    sections.forEach((el) => io.observe(el));
    observers.push(io);

    // The contact panel is a fixed element, so the center-band observer never
    // fires for it - activate it by overall scroll progress instead.
    const contactSec = document.querySelector<HTMLElement>('[data-section="contact"]');
    if (contactSec) {
        const onSpyScroll = () => {
            if ((lenis?.progress ?? nativeProgress()) > 0.985) setActive(contactSec);
        };
        if (lenis) {
            lenis.on("scroll", onSpyScroll);
        } else {
            window.addEventListener("scroll", onSpyScroll, { passive: true });
            cleanups.push(() => window.removeEventListener("scroll", onSpyScroll));
        }
        onSpyScroll();
    }
}

/* ------------------------------------------------------------------ */
/* Card-stack journey (pinned coaster pile)                            */
/* ------------------------------------------------------------------ */

type CardStack = {
    section: HTMLElement;
    cards: HTMLElement[];
    top: number;
    /** Vertical scroll spent per landing card. */
    per: number;
    /** Total scrubbed travel (cards after the first). */
    distance: number;
    buffer: number;
    offX: number;
    offY: number;
    /** Mobile: cards rise from below instead of flying in from the right. */
    vertical: boolean;
    /** `data-stack-mode="focus"`: nothing lands on a pile. The engine only
     *  reports each card's distance from focus (--f) and CSS flies the
     *  visitor through them, one in focus at a time. */
    focus: boolean;
    /** Focus stacks: the `[data-stack-contents]` entries naming each card, in
     *  order. The one in focus is marked `is-current`. */
    contents: HTMLElement[];
};

function measureCardStacks(): CardStack[] {
    const result: CardStack[] = [];
    const desktop = isDesktop();

    for (const section of document.querySelectorAll<HTMLElement>("[data-cardstack]")) {
        // The featured strip carries both attributes: on desktop it is a
        // pinned pile with its own choreography (measureShowcases owns it
        // there) and only uses the plain cardstack deck on mobile.
        if (desktop && section.hasAttribute("data-hscroll")) continue;
        const cards = Array.from(
            section.querySelectorAll<HTMLElement>("[data-stack-card]"),
        );
        if (cards.length < 2) continue;

        // Generous read-time: each coaster owns ~0.9 viewport of scroll
        // (a bit brisker on mobile, where scrolling is thumb-flicks).
        const per = Math.round(layoutViewportH * (desktop ? 0.65 : 0.6));
        const distance = (cards.length - 1) * per;
        // Cushion on entry and exit: pinned, but the pile holds still for
        // this much vertical scroll before/after the landing sequence.
        const buffer = Math.round(layoutViewportH * (desktop ? 0.45 : 0.3));
        // Cascade offset per card. Desktop: diagonal coaster pile (keep in
        // sync with .journey-stack CSS vars). Mobile: a slim vertical deck -
        // each landing card covers the pile, leaving a 10px edge per card.
        const offX = desktop ? parseFloat(section.dataset.offX ?? "26") : 0;
        const offY = desktop ? parseFloat(section.dataset.offY ?? "48") : 10;

        section.style.height = `${layoutViewportH + distance + buffer * 2}px`;
        const top = section.getBoundingClientRect().top + window.scrollY;
        const focus = section.dataset.stackMode === "focus";
        result.push({
            section, cards, top, per, distance, buffer, offX, offY,
            vertical: !desktop,
            focus,
            contents: Array.from(
                section.querySelectorAll<HTMLElement>("[data-stack-contents] > *"),
            ),
        });
    }
    return result;
}

/* ------------------------------------------------------------------ */
/* Static layout (prefers-reduced-motion)                              */
/* ------------------------------------------------------------------ */

/**
 * Reduced motion turns every scroll-driven effect off, but the markup those
 * effects drive is not laid out to stand on its own: the pinned viewports
 * stick and clip, and both card piles are absolutely positioned stacks whose
 * cards sit on top of each other until the engine transforms them apart.
 *
 * Undo those rules inline so the page reads as a plain document - every card
 * in normal flow, fully visible, nothing pinned and nothing overlapping. The
 * `reduced-motion` class on `<html>` is the hook for any CSS that needs to
 * opt out of the same choreography.
 */
function layoutStatic(): void {
    const style = (selector: string, styles: Partial<CSSStyleDeclaration>) => {
        for (const el of document.querySelectorAll<HTMLElement>(selector)) {
            Object.assign(el.style, styles);
        }
    };

    // Section heights exist only to buy scroll for the choreography.
    style("[data-pin], [data-cardstack], [data-hscroll]", { height: "auto" });

    // Pinned viewports: stop sticking, stop clipping, stop reserving a screen.
    style(".pin-viewport, .journey-viewport, .hscroll-viewport", {
        position: "static",
        height: "auto",
        overflow: "visible",
    });
    // The showcase viewport centers several stage layers as flex siblings;
    // in flow they have to stack instead of sitting side by side.
    style(".hscroll-viewport", { display: "block" });

    // Full-bleed exists so cards can fly in from the window edge. In flow it
    // just breaks the page's column.
    style(".hscroll-pin", { marginLeft: "0", marginRight: "0" });

    // The pile stages: fixed-size boxes holding absolute cards.
    style("[data-hscroll-track], .stack-area", {
        position: "static",
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        width: "auto",
        height: "auto",
    });
    style("[data-stack-card], [data-spotlight]", {
        position: "static",
        width: "auto",
        height: "auto",
        transform: "none",
        opacity: "1",
        willChange: "auto",
    });

    // Stage layers the engine flies across the pin: the chapter mark and the
    // docked headline. Each is either absolute itself or centered by an
    // absolute wrapper; dropping that puts them in flow above the cards, in
    // DOM order. The featured cards' own side-by-side composition is undone
    // in global.css (html.reduced-motion).
    for (const el of document.querySelectorAll<HTMLElement>(
        "[data-cover-content], [data-hscroll-headline]",
    )) {
        for (const box of [el, el.parentElement]) {
            if (box && getComputedStyle(box).position === "absolute") {
                box.style.position = "static";
            }
        }
    }
}

/* ------------------------------------------------------------------ */
/* Pinned dwell sections                                               */
/* ------------------------------------------------------------------ */

/**
 * `data-pin="0.6"` gives a section 60vh of extra height; its `.pin-viewport`
 * child sticks for that dwell, so every page holds you (journey-style)
 * before releasing - without any horizontal travel.
 */
function applyPins(): void {
    for (const section of document.querySelectorAll<HTMLElement>("[data-pin]")) {
        // Mobile skips pins unless the section opts in (data-pin-mobile,
        // e.g. the hero so its explosion plays on a held screen).
        if (!isDesktop() && !section.hasAttribute("data-pin-mobile")) {
            section.style.height = "";
            continue;
        }
        const dwell = parseFloat(section.dataset.pin ?? "0.6");
        section.style.height = `${Math.round(layoutViewportH * (1 + dwell))}px`;
    }
}

/* ------------------------------------------------------------------ */
/* Featured showcase (pinned card pile, desktop)                       */
/* ------------------------------------------------------------------ */

/**
 * Desktop flow of the featured projects section (the [data-hscroll]
 * attribute names survive from its filmstrip past): the chapter mark
 * enters centered, the first card flies in from the right and pushes it
 * out left, every card lands on a journey-style pile, and once the pile
 * is complete it exits left as one object while the listing below climbs
 * in. Mobile runs the cardstack deck instead.
 */
type Showcase = {
    section: HTMLElement;
    /** The pile container: cards stack inside it; the exit slides IT left. */
    track: HTMLElement;
    cards: HTMLElement[];
    /** Chapter-cover mark: pushed out left by the first card's arrival. */
    coverEl: HTMLElement | null;
    /** Viewport x of the mark's right edge at rest (for the exit fade). */
    coverRight: number;
    /** Docked headline (fades in on entry, leaves with the pile). */
    headline: HTMLElement | null;
    headlineW: number;
    /** The pile's resting right edge: the exit glues the headline to it. */
    dockRight: number;
    /** `data-hscroll-mode="strip"`: projects pass through one at a time
     *  instead of landing on a pile (they have no surface to pile with). */
    strip: boolean;
    /** Docked x for the headline: the pile's resting left edge. */
    dockLeft: number;
    /** Pile cascade offset per card. */
    offX: number;
    offY: number;
    /** Vertical scroll spent per landing card. */
    per: number;
    /** Dwell after the last landing, before the pile exits. */
    settle: number;
    /** Scroll spent on the pile's exit slide. */
    exitDist: number;
    buffer: number;
    top: number;
    /** Which clamped end state the engine last wrote while the showcase was
     *  out of range: before it starts, after it ends, or none (in range). */
    rested: "before" | "after" | null;
};

function measureShowcases(): Showcase[] {
    if (!isDesktop()) return [];
    const result: Showcase[] = [];

    for (const section of document.querySelectorAll<HTMLElement>("[data-hscroll]")) {
        const track = section.querySelector<HTMLElement>("[data-hscroll-track]");
        if (!track) continue;
        const cards = Array.from(
            track.querySelectorAll<HTMLElement>("[data-spotlight]"),
        );
        if (!cards.length) continue;

        // Reset scroll-driven state before measuring resting rects.
        track.style.transform = "";
        track.style.opacity = "";
        cards.forEach((c) => (c.style.opacity = ""));
        const coverEl =
            section.closest("section")?.querySelector<HTMLElement>("[data-cover-content]") ?? null;
        if (coverEl) {
            coverEl.style.transform = "";
            coverEl.style.opacity = "";
        }

        const vh = window.innerHeight;
        // Read-time per landing card, a settle beat on the full pile, and
        // one exit slide.
        const strip = section.dataset.hscrollMode === "strip";
        // A strip segment is an arrival plus a dwell, so it runs longer:
        // about 0.45vh to arrive and 0.4vh held still (STRIP_ARRIVE splits
        // it); the rest snap seats a project that stops mid-arrival.
        const per = Math.round(vh * (strip ? 0.85 : 0.75));
        const settle = Math.round(vh * 0.3);
        const exitDist = Math.round(vh * 0.5);
        const buffer = Math.round(vh * 0.3);
        // Cascade offsets; keep in sync with the .hscroll-pin CSS calc.
        const offX = parseFloat(section.dataset.offX ?? "24");
        const offY = parseFloat(section.dataset.offY ?? "28");

        // A cushion on entry only: the pin lets go as the pile leaves, so
        // the listing below (index.astro, negative margin) climbs in under
        // the exit instead of after an empty stage.
        section.style.height =
            `${vh + buffer + cards.length * per + settle + exitDist}px`;
        const sectionRect = section.getBoundingClientRect();
        const top = sectionRect.top + window.scrollY;
        const coverRight = coverEl
            ? Math.round(coverEl.getBoundingClientRect().right)
            : 0;

        // Seat the headline just above the pile's top card (its CSS top is
        // only a no-JS fallback), snug to the composition at any size.
        const headline =
            section.querySelector<HTMLElement>("[data-hscroll-headline]");
        const trackRect = track.getBoundingClientRect();
        if (headline) {
            const viewport =
                section.querySelector<HTMLElement>(".hscroll-viewport") ?? section;
            headline.style.top = `${Math.round(
                trackRect.top -
                    viewport.getBoundingClientRect().top -
                    headline.offsetHeight -
                    16,
            )}px`;
        }

        result.push({
            section, track, cards, coverEl, coverRight,
            headline,
            headlineW: headline?.offsetWidth ?? 0,
            // Section space, not viewport space: the headline is positioned
            // inside the full-bleed section, which sits half a
            // scrollbar-width left of the viewport origin.
            dockRight: Math.round(trackRect.right - sectionRect.left),
            dockLeft: Math.round(trackRect.left - sectionRect.left),
            offX, offY, per, settle, exitDist, buffer, top,
            strip, rested: null,
        });
    }
    return result;
}

/* ------------------------------------------------------------------ */
/* Chapter covers (title slides that fade as their content arrives)   */
/* ------------------------------------------------------------------ */

type Cover = { content: HTMLElement; top: number; dist: number };

/** Strip showcases: the share of a project's scroll segment spent arriving.
 *  The rest is dwell: the project holds still, aligned, before the next one
 *  starts to move. Purely scroll-scrubbed: a transition stopped half way
 *  stays half way, nothing pulls it on or back. */
const STRIP_ARRIVE = 0.53;

/** `[data-cover]` blocks pin (via data-pin) while their `[data-cover-content]`
 *  fades and lifts away over the pin's dwell distance. */
function measureCovers(): Cover[] {
    if (!isDesktop()) return [];
    const result: Cover[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("[data-cover]")) {
        const content = el.querySelector<HTMLElement>("[data-cover-content]");
        if (!content) continue;
        const dist = Math.max(1, el.offsetHeight - window.innerHeight);
        const top = el.getBoundingClientRect().top + window.scrollY;
        result.push({ content, top, dist });
    }
    return result;
}

/* ------------------------------------------------------------------ */
/* Entry hold (for sections too tall to pin, e.g. the projects grid)   */
/* ------------------------------------------------------------------ */

type Hold = { content: HTMLElement; top: number; dist: number };

/**
 * `data-hold="0.9"`: on arrival the section's `[data-hold-content]` counter-
 * translates against the scroll for 0.9 viewport - visually frozen, like a
 * pin dwell - then releases into normal scrolling. The section gets matching
 * bottom margin so the released content doesn't spill into the next section.
 */
function measureHolds(): Hold[] {
    if (!isDesktop()) {
        document
            .querySelectorAll<HTMLElement>("[data-hold]")
            .forEach((s) => (s.style.marginBottom = ""));
        return [];
    }
    const result: Hold[] = [];
    for (const section of document.querySelectorAll<HTMLElement>("[data-hold]")) {
        const content = section.querySelector<HTMLElement>("[data-hold-content]");
        if (!content) continue;
        const dist = Math.round(
            window.innerHeight * parseFloat(section.dataset.hold ?? "0.9"),
        );
        section.style.marginBottom = `${dist}px`;
        // Engage 15vh early, while the block's top edge is still in view -
        // otherwise the first rows scroll past before the hold catches.
        // A tall block can ask to be seated higher (data-hold-at, in vh).
        const top =
            section.getBoundingClientRect().top +
            window.scrollY -
            Math.round(window.innerHeight * parseFloat(section.dataset.holdAt ?? "0.15"));
        result.push({ content, top, dist });
    }
    return result;
}

/* ------------------------------------------------------------------ */
/* Chapter-mark drift                                                  */
/* ------------------------------------------------------------------ */

type MarkDrift = {
    el: HTMLElement;
    settleAt: number;
    entryLag: boolean;
    sinkSpeed: number;
    sinkCap: number;
};

/**
 * The chapter numerals + hook lines get two drift phases:
 * - APPROACH: a slight lag behind the section's content (parallax depth),
 *   converging to zero moments after entering. Marks rigidly paired with
 *   content skip this - the journey mark's top must equal the first
 *   card's top from the very first visible pixel.
 * - SETTLED SINK: a while after seating in the aligned position, marks in
 *   normal-flow sections glide downward very slowly as scroll continues.
 * Pinned Journey and Projects marks stay rigid. Tiny fractional transforms
 * rerasterize their stretched SVG lettering and read as jitter against a
 * stationary viewport. The contact panel's fixed mark also stays put.
 */
function measureMarkDrifts(): MarkDrift[] {
    // Desktop only: JS transforms lag behind native touch scrolling.
    if (!isDesktop()) return [];
    const all = Array.from(
        document.querySelectorAll<HTMLElement>(".chapter-mark"),
    );
    // Reset everything first: a mark excluded below must not keep a
    // residual drift transform from an earlier measure.
    all.forEach((el) => (el.style.transform = ""));
    return all
        .filter((el) => !el.closest(".contact-panel, .journey-stack, .hscroll-pin"))
        .map((el) => {
            const r = el.getBoundingClientRect();
            // "Settled" once the mark's top passes ~72% of the viewport -
            // i.e. moments after it enters.
            return {
                el,
                settleAt: Math.round(
                    r.top + window.scrollY - window.innerHeight * 0.72,
                ),
                entryLag: true,
                sinkSpeed: 0.04,
                sinkCap: 80,
            };
        });
}

/* ------------------------------------------------------------------ */
/* Scroll-driven frame update                                          */
/* ------------------------------------------------------------------ */

/** A card under the pile's top blurs slightly as the next card lands on it
 *  (CSS reads --covered). `landed` is that next card's landing scrub, so the
 *  blur builds with scroll instead of switching. The class keeps uncovered
 *  cards free of any filter. */
function setCovered(card: HTMLElement, landed: number): void {
    const eased = landed * landed * (3 - 2 * landed);
    const value = eased.toFixed(3);
    if (card.style.getPropertyValue("--covered") === value) return;
    card.style.setProperty("--covered", value);
    card.classList.toggle("is-covered", eased > 0);
}

/** Share of each focus-stack segment a card spends fully in focus, either
 *  side of its centre, before it starts to leave. */
const FOCUS_DWELL = 0.3;
/** A card has left by this offset and the next only starts arriving after
 *  it, so two cards' copy is never on stage together. */
const FOCUS_HANDOVER = 0.5;

/** Focus stacks: `--f` runs from -1 (still far ahead) through 0 (in focus)
 *  to 1 (passed the camera). */
function focusStack(s: CardStack, local: number): void {
    const position = Math.max(0, Math.min(s.cards.length - 1, local / s.per));
    const current = Math.round(position);
    s.contents.forEach((entry, i) => entry.classList.toggle("is-current", i === current));
    s.cards.forEach((card, i) => {
        const offset = position - i;
        const travel = Math.max(0, Math.abs(offset) - FOCUS_DWELL) / (FOCUS_HANDOVER - FOCUS_DWELL);
        const focus = Math.sign(offset) * Math.min(1, travel);
        // Settled while in focus; the headline's light leaves with it.
        const away = Math.abs(focus);
        setLight(card, "settle", 1 - away * away * (3 - 2 * away));
        const value = focus.toFixed(3);
        if (card.style.getPropertyValue("--f") === value) return;
        card.style.setProperty("--f", value);
        card.classList.toggle("is-active", Math.abs(focus) < 0.5);
        // The opacity global.css flies the card with; at zero the card is
        // hidden outright, so its blur and layer cost nothing while unseen.
        const opacity = 1 + Math.min(0, focus) * 1.2 - Math.max(0, focus) * 1.5;
        card.classList.toggle("is-gone", opacity <= 0);
    });
}

function bindScrollDriven(reduced: boolean): void {
    const bar = document.getElementById("scroll-progress");
    const hue = document.getElementById("bottom-hue");
    // The contact panel sits fixed under the whole page; keep it hidden
    // until the reveal is near, or a hard overscroll bounce at the top
    // flashes it through the gap behind the lifting page.
    const panel = document.querySelector<HTMLElement>(".contact-panel");
    const heroScrub = reduced
        ? null
        : document.querySelector<HTMLElement>("[data-hero-scrub]");
    // Speeds are read once, not per frame. Driven from the RAF loop (see
    // parallaxTick below): scroll drift on both platforms, plus a lerped
    // cursor-follow depth shift on desktop.
    const wrapLayers = reduced
        ? []
        : Array.from(document.querySelectorAll<HTMLElement>("[data-parallax-wrap]"))
            .map((el) => ({
                el,
                speed: parseFloat(el.dataset.parallaxSpeed ?? "0.1"),
            }));

    if (wrapLayers.length) {
        const mouse = { tx: 0, ty: 0, x: 0, y: 0 };
        if (isDesktop()) {
            const onPointer = (ev: PointerEvent) => {
                mouse.tx = ev.clientX / window.innerWidth - 0.5;
                mouse.ty = ev.clientY / window.innerHeight - 0.5;
            };
            window.addEventListener("pointermove", onPointer, { passive: true });
            cleanups.push(() =>
                window.removeEventListener("pointermove", onPointer),
            );
        }
        let lastWritten = -1;
        parallaxTick = () => {
            mouse.x += (mouse.tx - mouse.x) * 0.05;
            mouse.y += (mouse.ty - mouse.y) * 0.05;
            const scroll = window.scrollY;
            // Idle guard: skip the writes when neither scroll nor cursor
            // moved meaningfully since the last frame.
            const key = scroll + mouse.x * 997 + mouse.y * 631;
            if (Math.abs(key - lastWritten) < 0.05) return;
            lastWritten = key;
            for (const layer of wrapLayers) {
                // Fold the vertical mouse shift into the wrap phase so the
                // translate stays within the tiled range (no seams).
                const phase = scroll * layer.speed + mouse.y * layer.speed * 140;
                // The canvas owns its exact repeat interval. It may repaint after
                // the layout resize, so never wrap it at an unrelated height.
                const tileH = Number(layer.el.dataset.parallaxHeight) || viewportH;
                const y = ((phase % tileH) + tileH) % tileH;
                const mx = mouse.x * layer.speed * -220;
                layer.el.style.transform = `translate3d(${mx}px, ${-y}px, 0)`;
            }
        };
        cleanups.push(() => (parallaxTick = null));
    }

    // Order matters: pins add height, which shifts everything below them,
    // so they must be applied before any position is measured.
    if (!reduced) applyPins();
    let stacks = reduced ? [] : measureCardStacks();
    let showcases = reduced ? [] : measureShowcases();
    let markDrifts = reduced ? [] : measureMarkDrifts();
    let holds = reduced ? [] : measureHolds();
    let covers = reduced ? [] : measureCovers();

    /** Scroll ranges the speed cap guards: every pin, card stack, showcase
     *  and hold, from the moment it engages until it lets go. */
    const measureStages = () => {
        const ranges: Array<[number, number]> = [];
        for (const section of document.querySelectorAll<HTMLElement>("[data-pin]")) {
            if (!section.style.height) continue;
            const top = section.getBoundingClientRect().top + window.scrollY;
            ranges.push([top, top + section.offsetHeight - layoutViewportH]);
        }
        for (const s of stacks) ranges.push([s.top, s.top + s.distance + s.buffer * 2]);
        for (const sc of showcases) {
            ranges.push([sc.top, sc.top + sc.section.offsetHeight - window.innerHeight]);
        }
        for (const h of holds) ranges.push([h.top, h.top + h.dist]);
        stageRanges = ranges;
    };
    if (!reduced) measureStages();
    cleanups.push(() => (stageRanges = []));

    // Rest snap. Never while the visitor is scrolling: it fires once the
    // scroll RESTS for 150ms (finger off, momentum spent), and any new wheel
    // input takes the page straight back, since Lenis starts its glide from
    // wherever the spring has got to. The page springs to the seat the last
    // movement was heading for (momentum projected, as a flick lands where
    // it is going) when it rests somewhere no reader should be left:
    // - inside a handover between two journey stops or two featured
    //   projects, with two half-faded texts on stage;
    // - part way into the contact reveal, the page edge hanging over the
    //   panel. Only its two ends are seats: closed or fully open.
    if (!reduced && lenis && isDesktop()) {
        let touching = false;
        const onTouchStart = () => (touching = true);
        const onTouchEnd = () => (touching = false);
        window.addEventListener("touchstart", onTouchStart, { passive: true });
        window.addEventListener("touchend", onTouchEnd, { passive: true });
        window.addEventListener("touchcancel", onTouchEnd, { passive: true });
        cleanups.push(() => {
            window.removeEventListener("touchstart", onTouchStart);
            window.removeEventListener("touchend", onTouchEnd);
            window.removeEventListener("touchcancel", onTouchEnd);
        });

        /** The seat nearest to where the movement was heading, when `y`
         *  rests inside a handover or the contact reveal; null anywhere else. */
        const snapTarget = (y: number, velocity: number): number | null => {
            // Apple's scroll projection (deceleration 0.998 per ms).
            const projected = y + (velocity / 1000) * 0.998 / (1 - 0.998);
            for (const s of stacks) {
                if (!s.focus) continue;
                const position = (y - s.top - s.buffer) / s.per;
                if (position <= 0 || position >= s.cards.length - 1) continue;
                const i = Math.floor(position);
                const within = position - i;
                if (within <= FOCUS_DWELL || within >= 1 - FOCUS_DWELL) continue;
                const heading = (projected - s.top - s.buffer) / s.per;
                return s.top + s.buffer + (heading < i + 0.5 ? i : i + 1) * s.per;
            }
            for (const sc of showcases) {
                if (!sc.strip) continue;
                const arrive = sc.per * STRIP_ARRIVE;
                const local = y - sc.top - sc.buffer;
                const i = Math.floor(local / sc.per);
                // Card 0's arrival hands over from the chapter mark, not a card.
                if (i < 1 || i >= sc.cards.length || local - i * sc.per >= arrive) continue;
                const centre = (k: number) => sc.top + sc.buffer + k * sc.per + (arrive + sc.per) / 2;
                const before = centre(i - 1), after = centre(i);
                return Math.abs(projected - before) < Math.abs(projected - after) ? before : after;
            }
            if (panel) {
                const open = document.documentElement.scrollHeight - window.innerHeight;
                const closed = open - panel.offsetHeight;
                if (y > closed + 1 && y < open - 1) {
                    return projected > (closed + open) / 2 ? open : closed;
                }
            }
            return null;
        };

        // Where and when the current movement began. A wheel glide decays
        // exponentially, so by the time it rests its last frames say nothing
        // about where it was going; the movement as a whole does.
        let motionFrom: [number, number] | null = null;
        let lastY = -1;
        let lastAt = 0;
        let restSince = -1;
        restTick = () => {
            if (!lenis) return;
            const now = performance.now();
            const y = window.scrollY;
            const moving = lastY >= 0 && Math.abs(y - lastY) >= 0.5;
            if (moving && !motionFrom) motionFrom = [lastAt, lastY];
            lastY = y;
            lastAt = now;
            if (touching || anchorBypass || moving || !motionFrom) {
                restSince = -1;
                if (touching || anchorBypass) motionFrom = null;
                return;
            }
            if (restSince < 0) restSince = now;
            if (now - restSince < 150) return;
            // Average velocity of the whole movement, px/s. The movement is
            // then spent; the next one (the spring's own, too) is measured
            // afresh, and a seat it lands on is never a snap target.
            const span = (restSince - motionFrom[0]) / 1000;
            const velocity = span > 0 ? (y - motionFrom[1]) / span : 0;
            motionFrom = null;
            const target = snapTarget(y, velocity);
            if (target !== null) springTo(target, 0.4);
        };
        cleanups.push(() => (restTick = null));
    }

    // Frozen viewport height for all per-frame math. Reading innerHeight
    // live wobbles frame-by-frame while the mobile URL bar animates, which
    // makes every vh-derived position (hero scrub, deck cards) jitter
    // mid-pin. Refreshed only on a real remeasure.
    let viewportH = layoutViewportH;

    const remeasure = () => {
        for (const s of stacks) s.section.style.height = "";
        // Clear the showcase's scroll-driven state here too: crossing to
        // mobile skips measureShowcases entirely, and the deck must not
        // inherit a translated pile or faded cards.
        for (const sc of showcases) {
            sc.section.style.height = "";
            sc.track.style.transform = "";
            sc.track.style.opacity = "";
            sc.cards.forEach((c) => (c.style.opacity = ""));
            if (sc.coverEl) {
                sc.coverEl.style.transform = "";
                sc.coverEl.style.opacity = "";
            }
        }
        updateViewport();
        viewportH = layoutViewportH;
        applyPins();
        stacks = measureCardStacks();
        showcases = measureShowcases();
        markDrifts = measureMarkDrifts();
        holds = measureHolds();
        covers = measureCovers();
        measureStages();
        lenis?.resize();
        onScroll();
    };

    if (!reduced) {
        let resizeTimer = 0;
        let lastWidth = window.innerWidth;
        const onResize = () => {
            // Mobile URL-bar collapse fires height-only resizes mid-scroll;
            // remeasuring then moves every pinned section under the finger.
            // Below the desktop breakpoint only a width change (rotation)
            // is a real layout change.
            if (window.innerWidth === lastWidth && !isDesktop()) return;
            lastWidth = window.innerWidth;
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(remeasure, 200);
        };
        window.addEventListener("resize", onResize);
        cleanups.push(() => {
            window.removeEventListener("resize", onResize);
            window.clearTimeout(resizeTimer);
        });

        // Positions are measured before images and fonts finish on a first
        // visit; anything that shifts layout afterwards leaves every pin
        // engaging slightly off (a visible jump when the sticky catches).
        // Re-measure once against the settled layout.
        let alive = true;
        cleanups.push(() => (alive = false));
        if (document.readyState !== "complete") {
            const onLoad = () => alive && remeasure();
            window.addEventListener("load", onLoad, { once: true });
            cleanups.push(() => window.removeEventListener("load", onLoad));
        }
        // Ignore if this page instance was torn down before fonts settled.
        document.fonts?.ready.then(() => alive && remeasure());
    }

    // Depth-of-field cards: full presence near the viewport center, fading
    // toward the edges (about cards use this to take turns in focus).
    // Opacity only: animating blur() on cards that also carry a backdrop
    // filter repainted the backdrop every single frame.
    const focusEls = reduced || !isDesktop()
        ? []
        : Array.from(document.querySelectorAll<HTMLElement>("[data-focus]"));

    // Prism moments: each chapter mark reports how settled it stands, 0..1:
    // centred on screen is settled, arriving or leaving is not. global.css
    // ramps the mark's light and its width axis with it. Measured on the
    // mark's parent, which no drift transform moves. The contact mark stands
    // still in its fixed panel, so it settles with the reveal instead.
    const marks = Array.from(document.querySelectorAll<HTMLElement>(".chapter-mark"));
    const contactMark = panel?.querySelector<HTMLElement>(".chapter-mark") ?? null;

    // DOM depth (desktop): `data-depth` content drifts by that share of its
    // distance from the viewport centre. Positive lags the scroll (farther
    // away), negative runs ahead of it (nearer). Transform only, and only on
    // elements no other effect transforms. Inside a pin or a hold the box
    // stands still, so the drift does too: held moments stay held.
    const depthEls = reduced || !isDesktop()
        ? []
        : Array.from(document.querySelectorAll<HTMLElement>("[data-depth]"))
            .map((el) => ({ el, depth: parseFloat(el.dataset.depth ?? "0"), shift: 0 }));

    let lastScrub = "";
    const onScroll = () => {
        const progress = lenis ? lenis.progress : nativeProgress();
        // The browser's actual offset, not Lenis's animated value: transforms
        // derived from it land in the same frame as the rendered scroll, so
        // pinned/held content doesn't shiver against the page.
        const scroll = window.scrollY;
        const vh = viewportH;
        // Measure before any write below, so reading the boxes never forces
        // the browser to settle this frame's styles and layout early.
        const focusRects = focusEls.map((el) => el.getBoundingClientRect());
        const markRects = marks.map((m) => (m.parentElement ?? m).getBoundingClientRect());
        const depthRects = depthEls.map((d) => d.el.getBoundingClientRect());
        let reveal = 0;
        if (contactMark && panel) {
            const open = document.documentElement.scrollHeight - window.innerHeight;
            const h = panel.offsetHeight || 1;
            reveal = Math.max(0, Math.min(1, (scroll - (open - h)) / h));
        }

        if (bar) {
            bar.style.transform = `scaleX(${progress || 0})`;
            // The tip's refraction drifts through the spectrum on the way down.
            bar.style.setProperty("--p", (progress || 0).toFixed(3));
        }

        marks.forEach((m, i) => {
            const r = markRects[i];
            let settle = 0;
            if (r.height > 0) {
                const off = Math.abs(r.top + r.height / 2 - vh / 2) / (vh / 2);
                const t = Math.max(0, Math.min(1, (off - 0.2) / 0.6));
                settle = 1 - t * t * (3 - 2 * t);
            }
            if (m === contactMark) settle *= reveal * reveal * (3 - 2 * reveal);
            setLight(m, "settle", settle);
        });

        depthEls.forEach((d, i) => {
            const r = depthRects[i];
            if (r.bottom < -200 || r.top > vh + 200) return;
            const centre = r.top + r.height / 2 - d.shift;
            const shift = Math.max(-48, Math.min(48, (centre - vh / 2) * d.depth));
            if (Math.abs(shift - d.shift) < 0.05) return;
            d.shift = shift;
            d.el.style.transform = `translate3d(0, ${shift.toFixed(1)}px, 0)`;
        });

        // Visible only near the end (the reveal starts around 0.88); 0.6
        // leaves a wide margin so no gesture can outrun the toggle. The
        // stylesheet default is hidden, so "visible" must be explicit.
        if (panel) panel.style.visibility = progress > 0.6 ? "visible" : "hidden";

        // Bottom hue: faint for most of the ride, blooming gently as the
        // end nears - and staying, so the contact reveal keeps its final
        // orange (the hue sits above the panel, below the page).
        if (hue) {
            const bloom = Math.max(0, Math.min(1, (progress - 0.68) / 0.2));
            const o = Math.min(1, 0.5 + bloom * 0.3);
            hue.style.opacity = o.toFixed(3);
        }

        if (heroScrub) {
            // The dissolve starts almost immediately (2vh guards against
            // accidental nudges) and eases in at t^1.5: early movement
            // registers right away without changing the full explosion.
            const raw = (scroll - vh * 0.02) / (vh * 0.61);
            const t = Math.max(0, Math.min(1, raw));
            // Written only when it changes: --scrub inherits through the
            // whole hero, and past the hero it would restyle it every frame.
            const scrub = String(Math.pow(t, 1.5));
            if (scrub !== lastScrub) {
                heroScrub.style.setProperty("--scrub", scrub);
                lastScrub = scrub;
            }
        }

        // (Particle layers are driven from the RAF loop - parallaxTick -
        // so the cursor can move them between scroll events too.)

        // Chapter marks: an approach lag that converges to zero on entry
        // (skipped for rigidly paired marks), then - a while after they
        // settle aligned - a very slow downward glide as scrolling goes on.
        for (const m of markDrifts) {
            const pre = m.entryLag
                ? Math.max(0, Math.min(60, (m.settleAt - scroll) * 0.1))
                : 0;
            const sink = Math.max(
                0,
                Math.min(
                    m.sinkCap,
                    (scroll - m.settleAt - vh * 0.6) * m.sinkSpeed,
                ),
            );
            m.el.style.transform =
                `translate3d(0, ${(pre + sink).toFixed(1)}px, 0)`;
        }

        // Depth-of-field focus (see focusEls above). A dead zone around the
        // center keeps the active card fully sharp, and outgoing cards
        // (above center) defocus far more slowly than incoming ones.
        focusEls.forEach((el, i) => {
            const r = focusRects[i];
            if (r.bottom < -150 || r.top > vh + 150) return;
            const mid = r.top + r.height / 2;
            const delta = mid - vh / 2;
            const norm =
                delta >= 0
                    ? delta / (vh / 2)
                    : (-delta / (vh / 2)) * 0.4;
            const d = Math.max(0, Math.min(1, norm) - 0.25) / 0.75;
            el.style.opacity = (1 - d * 0.55).toFixed(3);
        });

        // Featured showcase pile (cushioned: waits out the entry buffer).
        // While inside one, the particle background lights up (CSS reacts
        // to the .in-showcase class).
        let inShowcase = false;
        for (const sc of showcases) {
            const local = scroll - sc.top - sc.buffer;
            const stackLen = sc.cards.length * sc.per;
            if (
                local > -vh * 0.2 &&
                local < stackLen + sc.settle + sc.exitDist
            ) {
                inShowcase = true;
            }
            // Every value below is clamped: before 0 and past the pile's
            // exit it sits at its first or last state. Write that once, then
            // leave the showcase alone until the scroll brings it back.
            const end = stackLen + sc.settle + sc.exitDist;
            const rested = local <= 0 ? "before" : local >= end ? "after" : null;
            if (rested && rested === sc.rested) continue;
            sc.rested = rested;

            // Cards fly in from the right, one per scroll beat, and land
            // on the pile with a cascading offset.
            // A strip project arrives over the first part of its segment and
            // holds for the rest; a pile card lands over the whole of it.
            const arrive = sc.per * (sc.strip ? STRIP_ARRIVE : 1);
            sc.cards.forEach((card, i) => {
                const t = Math.max(0, Math.min(1, (local - i * sc.per) / arrive));
                // Strip: ease both ways, so a project also settles into its
                // seat instead of only braking at it.
                const eased = sc.strip ? t * t * (3 - 2 * t) : 1 - Math.pow(1 - t, 3);
                const slide = (1 - eased) * (window.innerWidth * 1.05);
                if (sc.strip) {
                    // Nothing piles: a project leaves to the left in step
                    // with the next one's arrival, like frames of a strip.
                    // The last one stays and leaves with the track.
                    const next = i + 1 < sc.cards.length
                        ? Math.max(0, Math.min(1, (local - (i + 1) * sc.per) / arrive))
                        : 0;
                    const gone = next * next * (3 - 2 * next) * (window.innerWidth * 1.05);
                    card.style.transform = `translate3d(${slide - gone}px, 0, 0)`;
                    // Arrival, 0..1: CSS moves the screenshot and the copy
                    // at different rates inside the card, for depth.
                    card.style.setProperty("--enter", eased.toFixed(3));
                    // How far from rest the card is, 0..1, arriving or
                    // leaving: the title's chromatic split opens with it.
                    const drift = Math.max(1 - eased, gone / (window.innerWidth * 1.05));
                    card.style.setProperty("--drift", drift.toFixed(3));
                    setLight(card, "settle", 1 - drift);
                    card.style.visibility = next >= 1 ? "hidden" : "";
                    return;
                }
                card.style.transform =
                    `translate3d(${i * sc.offX + slide}px, ${i * sc.offY}px, 0)`;
                // The first card keeps the atmospheric surface. Later cards
                // turn fully opaque only once seated, so copy beneath cannot
                // show through while the visitor reads the active card.
                card.classList.toggle("is-settled", i > 0 && t >= 0.68);
                setCovered(card, i + 1 < sc.cards.length
                    ? Math.max(0, Math.min(1, (local - (i + 1) * sc.per) / sc.per))
                    : 0);
            });

            // The first card's arrival pushes the chapter mark out left;
            // the fade is late and sharp so the exit reads as motion.
            if (sc.coverEl) {
                const t0 = Math.max(0, Math.min(1, local / arrive));
                const eased = 1 - Math.pow(1 - t0, 3);
                const push = eased * (sc.coverRight + 60);
                sc.coverEl.style.transform = `translate3d(${-push}px, 0, 0)`;
                const rightEdge = sc.coverRight - push;
                const co = Math.max(0, Math.min(1, (rightEdge - 220) / 80));
                sc.coverEl.style.opacity = co.toFixed(3);
            }

            // Once the pile is complete (plus a settle beat) it exits left
            // as ONE object, at full opacity - pure motion; it passes
            // behind the sidebar - while the listing climbs in below.
            const e = Math.max(
                0,
                Math.min(1, (local - stackLen - sc.settle) / sc.exitDist),
            );
            // Smoothstep: the slide spends its whole scroll length moving
            // (a cubic ease-out front-loads it into a couple of frames).
            const easedE = e * e * (3 - 2 * e);
            const pileX = -easedE * (window.innerWidth * 1.15);
            sc.track.style.transform = `translate3d(${pileX}px, 0, 0)`;

            // Docked headline: fades in mid-flight of the FIRST card - after
            // the chapter mark has been pushed away, so they never share the
            // stage. On the exit it holds its dock until the pile's trailing
            // edge catches it, then rides out with the last card.
            if (sc.headline) {
                const hx = Math.min(
                    sc.dockLeft,
                    sc.dockRight + pileX - sc.headlineW,
                );
                sc.headline.style.transform = `translate3d(${hx}px, 0, 0)`;
                const inO = Math.max(
                    0,
                    Math.min(1, (local - sc.per * 0.45) / (sc.per * 0.3)),
                );
                sc.headline.style.opacity = inO.toFixed(3);
            }
        }
        document.documentElement.classList.toggle("in-showcase", inShowcase);

        // Entry holds: content counter-scrolls (appears frozen) for the hold
        // distance after the section arrives, then rides along normally.
        for (const h of holds) {
            const y = Math.max(0, Math.min(h.dist, scroll - h.top));
            h.content.style.transform = `translate3d(0, ${y}px, 0)`;
        }

        // Pinned card stacks: each card slides up from below and lands on the
        // pile with a cascading offset, one per scroll segment (cushioned).
        for (const s of stacks) {
            const local = scroll - s.top - s.buffer;
            if (s.focus) {
                focusStack(s, local);
                continue;
            }
            s.cards.forEach((card, i) => {
                const rx = i * s.offX;
                const ry = i * s.offY;
                // Card i+1 lands over segment i. Phone decks leave only a
                // 10px edge showing, so they skip the blur.
                setCovered(card, !s.vertical && i + 1 < s.cards.length
                    ? Math.max(0, Math.min(1, (local - i * s.per) / s.per))
                    : 0);
                if (i === 0) {
                    card.style.transform = `translate3d(0, 0, 0)`;
                    card.classList.remove("is-settled");
                    return;
                }
                const t = Math.max(0, Math.min(1, (local - (i - 1) * s.per) / s.per));
                const eased = 1 - Math.pow(1 - t, 3);
                // Cards fly in from the right (desktop) or rise from below
                // (mobile) and land on the pile.
                const slide =
                    (1 - eased) * (s.vertical ? vh * 1.05 : window.innerWidth * 0.9);
                card.style.transform = s.vertical
                    ? `translate3d(${rx}px, ${ry + slide}px, 0)`
                    : `translate3d(${rx + slide}px, ${ry}px, 0)`;
                card.classList.toggle("is-settled", t >= 0.68);
            });
        }
    };

    if (lenis) {
        lenis.on("scroll", onScroll);
    } else {
        window.addEventListener("scroll", onScroll, { passive: true });
        cleanups.push(() => window.removeEventListener("scroll", onScroll));
    }
    onScroll();
}

/* ------------------------------------------------------------------ */
/* Velocity marquee (ticks every frame, so it lives in the RAF loop)   */
/* ------------------------------------------------------------------ */

type Marquee = {
    track: HTMLElement | null;
    /** Cached half of the track's scroll width (a per-frame read of
     *  scrollWidth forces layout on every frame of the whole page). */
    half: number;
    /** Off-screen the marquee sleeps entirely. */
    visible: boolean;
    offset: number;
    skew: number;
    retry: number;
};

const marquee: Marquee = {
    track: null, half: 0, visible: false, offset: 0, skew: 0, retry: 0,
};

/** Wire up a freshly found track: cache its width, watch visibility. */
function adoptMarqueeTrack(track: HTMLElement): void {
    marquee.track = track;
    marquee.half = track.scrollWidth / 2;

    const io = new IntersectionObserver((entries) => {
        for (const e of entries) marquee.visible = e.isIntersecting;
    });
    io.observe(track);
    observers.push(io);

    const ro = new ResizeObserver(() => {
        marquee.half = track.scrollWidth / 2;
    });
    ro.observe(track);
    cleanups.push(() => ro.disconnect());
}

function tickMarquee(frameScale: number): void {
    // The marquee is a hydrated React island; it may appear after init.
    if (!marquee.track || !marquee.track.isConnected) {
        marquee.track = null;
        marquee.visible = false;
        if (marquee.retry++ % 30 === 0) {
            const track = document.querySelector<HTMLElement>("[data-marquee-track]");
            if (track) adoptMarqueeTrack(track);
        }
        if (!marquee.track) return;
    }

    const half = marquee.half;
    if (!marquee.visible || half <= 0) return;

    const velocity = lenis?.velocity ?? 0;
    marquee.offset += (1.4 + Math.min(Math.abs(velocity) * 0.25, 10)) * frameScale;

    // Skew with scroll velocity, ease back to rest.
    const targetSkew = Math.max(-10, Math.min(10, velocity * 0.35));
    marquee.skew += (targetSkew - marquee.skew) * (1 - Math.pow(0.88, frameScale));

    marquee.track.style.transform =
        `translate3d(${-(marquee.offset % half)}px, 0, 0) skewX(${marquee.skew.toFixed(2)}deg)`;
}

/* ------------------------------------------------------------------ */
/* Anchor jumps                                                        */
/* ------------------------------------------------------------------ */

function setupAnchors(): void {
    const links = document.querySelectorAll<HTMLAnchorElement>(
        'a[href^="#"], a[href^="/#"]',
    );
    links.forEach((a) => {
        const handler = (e: Event) => {
            const href = a.getAttribute("href") ?? "";
            const hash = href.startsWith("/#") ? href.slice(1) : href;
            if (hash === "#" || (href.startsWith("/#") && location.pathname !== "/")) return;
            const target = document.querySelector<HTMLElement>(hash);
            if (!target) return;
            e.preventDefault();
            const main = document.querySelector<HTMLElement>("main");
            if (lenis && main) {
                // Rest behaviours stand down for the jump (safety timeout in
                // case the scroll gets interrupted and onComplete never fires).
                anchorBypass = true;
                const failsafe = window.setTimeout(() => (anchorBypass = false), 3000);
                const done = () => {
                    window.clearTimeout(failsafe);
                    anchorBypass = false;
                };
                const top = target.getBoundingClientRect().top;
                if (Math.abs(top) > ANCHOR_FADE_JUMP * layoutViewportH) {
                    // A long jump would tear past every stage on the way.
                    // The page fades out, lands, and fades back in already
                    // laid out for its new position (the jump's scroll event
                    // runs the whole choreography once).
                    main.style.transition = "opacity 150ms ease-out";
                    main.style.opacity = "0";
                    window.setTimeout(() => {
                        lenis?.scrollTo(target, { immediate: true, force: true });
                        requestAnimationFrame(() => {
                            main.style.transition = "opacity 220ms ease-out";
                            main.style.opacity = "";
                            window.setTimeout(() => {
                                main.style.transition = "";
                                done();
                            }, 220);
                        });
                    }, 150);
                } else {
                    // A short hop springs there: it starts the instant the
                    // link is pressed and settles without overshoot.
                    springTo(lenis.animatedScroll + top, 0.45, done);
                }
            } else {
                // No Lenis (phones, reduced motion): the browser's own glide,
                // unless motion is to be kept still.
                target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" });
            }
            history.replaceState(null, "", hash);
        };
        a.addEventListener("click", handler);
        cleanups.push(() => a.removeEventListener("click", handler));
    });
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

/**
 * A reload restarts at the top. The browser and the ClientRouter otherwise
 * restore the old position, and a hash left behind by a nav click jumps
 * straight to that section, dropping the visitor into the middle of the
 * choreography. Fresh visits and shared #links still open where they point;
 * only the first page-load of a reloaded document is affected.
 */
let firstPageLoad = true;
function restartOnReload(): void {
    if (!firstPageLoad) return;
    firstPageLoad = false;
    const nav = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
    if (nav?.type !== "reload") return;
    history.scrollRestoration = "manual";
    if (location.hash) {
        history.replaceState(history.state, "", location.pathname + location.search);
    }
    window.scrollTo(0, 0);
}

export function destroySmoothScroll(): void {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    anchorBypass = false;
    lenis?.destroy();
    lenis = null;
    marquee.track = null;
    marquee.visible = false;
    marquee.half = 0;
    observers.forEach((o) => o.disconnect());
    observers.length = 0;
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
}

export function initSmoothScroll(): void {
    destroySmoothScroll();
    // Before Lenis is created, so it starts from the top as well.
    restartOnReload();
    const reduced = prefersReducedMotion();
    updateViewport();
    document.documentElement.classList.toggle("reduced-motion", reduced);

    if (!reduced) {
        // Touch scrolling stays browser-owned. The animation RAF still runs,
        // but no Lenis rest behaviour can restart a completed mobile gesture.
        if (isDesktop() && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            // How sure the engine is that the wheel events come from a
            // trackpad, 0..1. A trackpad streams small, often fractional
            // pixel deltas every frame or two; a mouse wheel sends whole
            // notches (or line-mode deltas), spaced apart. The score drifts
            // with each event and fades during pauses, so the glide eases
            // between the two settings instead of switching.
            let trackpad = 0;
            let lastWheel = 0;
            lenis = new Lenis({
                lerp: SCROLL_LERP,
                smoothWheel: true,
                wheelMultiplier: 1,
                // Runs per wheel event, before the delta (multiplier already
                // applied) reaches the target, and may rewrite it.
                virtualScroll: (data) => {
                    if (!lenis) return true;
                    const event = data.event;
                    if (event instanceof WheelEvent) {
                        const now = performance.now();
                        const gap = now - lastWheel;
                        lastWheel = now;
                        const size = Math.abs(event.deltaY);
                        const fine = event.deltaMode === 0 && (size % 1 !== 0 || size < 50);
                        trackpad *= Math.exp(-Math.max(0, gap - 50) / 400);
                        trackpad += ((fine && gap < 120 ? 1 : 0) - trackpad) * 0.3;
                        lenis.options.lerp = SCROLL_LERP + (TRACKPAD_LERP - SCROLL_LERP) * trackpad;
                    }
                    const target = lenis.targetScroll + data.deltaY;
                    if (!crossesStage(lenis.animatedScroll, target)) return true;
                    // Lenis damps the lead by 1 - e^-lerp per 60Hz frame.
                    const perFrame = 1 - Math.exp(-lenis.options.lerp);
                    const maxLead = (MAX_SCROLL_SPEED * layoutViewportH) / (60 * perFrame);
                    const lead = lenis.targetScroll - lenis.animatedScroll;
                    const next = Math.max(-maxLead, Math.min(maxLead, lead + data.deltaY));
                    data.deltaY = next - lead;
                    return true;
                },
            });
        }

        let previousTime = 0;
        const raf = (time: number) => {
            // Equal speed on 60/120Hz displays; no catch-up jump after a
            // background tab resumes.
            const frameScale = previousTime ? Math.min((time - previousTime) / (1000 / 60), 2) : 1;
            previousTime = time;
            lightRead?.();
            lenis?.raf(time);
            tickMarquee(frameScale);
            restTick?.();
            parallaxTick?.();
            lightWrite?.();
            rafId = requestAnimationFrame(raf);
        };
        rafId = requestAnimationFrame(raf);

        setupReveal();
    } else {
        document
            .querySelectorAll("[data-reveal]")
            .forEach((el) => el.classList.add("is-visible"));
        layoutStatic();
    }

    setupWordReveals(reduced);
    setupMagnetic(reduced);
    setupPointerLight(reduced);
    setupScrollSpy();
    setupAnchors();
    // Applies pin/stack heights against the final stretched layout.
    bindScrollDriven(reduced);
}

/** Bind once; ClientRouter fires page-load on initial load and every navigation. */
export function wireSmoothScroll(): void {
    document.addEventListener("astro:page-load", initSmoothScroll);
    document.addEventListener("astro:before-swap", destroySmoothScroll);
}
