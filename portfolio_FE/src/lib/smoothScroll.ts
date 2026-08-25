import Lenis from "lenis";

/**
 * Scroll engine for the one-page "terminal session" site.
 *
 * Owns the Lenis instance, its RAF loop, snap points, and every scroll-driven
 * effect: progress bar, hero dissolve, wrapped particle parallax, relative
 * parallax (ghost numerals), the pinned horizontal journey, the velocity
 * marquee, typed prompts, reveal-on-scroll, and the sidebar scroll spy.
 *
 * Astro's ClientRouter swaps the DOM per navigation, so everything is torn
 * down on `astro:before-swap` and rebuilt on `astro:page-load`.
 */

let lenis: Lenis | null = null;
let rafId = 0;
/** True while an anchor-click scroll is in flight (section walls stand down). */
let anchorBypass = false;
/** Per-frame contact-reveal magnet, set by bindScrollDriven (needs its
 *  measurements); runs from the RAF loop since rest detection can't live
 *  in scroll events. */
let magnetTick: (() => void) | null = null;
/** Per-frame particle-layer driver (scroll drift + lerped mouse parallax);
 *  lives in the RAF loop because the cursor moves without scroll events. */
let parallaxTick: (() => void) | null = null;
const observers: IntersectionObserver[] = [];
const cleanups: Array<() => void> = [];

const prefersReducedMotion = (): boolean =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Desktop = the sidebar layout. Tablets and landscape phones (768-1023px)
   run the mobile choreography: the pinned side-by-side compositions need
   more width than they have. Must mirror the breakpoints in global.css. */
const isDesktop = (): boolean =>
    window.matchMedia("(min-width: 1024px)").matches;

function nativeProgress(): number {
    const el = document.documentElement;
    const max = el.scrollHeight - el.clientHeight;
    return max > 0 ? el.scrollTop / max : 0;
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
/* Typed command prompts                                               */
/* ------------------------------------------------------------------ */

/**
 * `<span data-type-cmd="cat about.txt"></span>` types itself out when it
 * scrolls into view, with a blinking caret while typing.
 */
function setupTypedPrompts(reduced: boolean): void {
    const els = document.querySelectorAll<HTMLElement>("[data-type-cmd]");
    if (!els.length) return;

    if (reduced) {
        els.forEach((el) => (el.textContent = el.dataset.typeCmd ?? ""));
        return;
    }

    const io = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const el = entry.target as HTMLElement;
                io.unobserve(el);

                const text = el.dataset.typeCmd ?? "";
                el.classList.add("is-typing");
                let i = 0;
                const interval = window.setInterval(() => {
                    el.textContent = text.slice(0, ++i);
                    if (i >= text.length) {
                        window.clearInterval(interval);
                        el.classList.remove("is-typing");
                        el.classList.add("is-typed");
                    }
                }, 45);
                cleanups.push(() => window.clearInterval(interval));
            }
        },
        { threshold: 0.6 },
    );

    els.forEach((el) => io.observe(el));
    observers.push(io);
}

/* ------------------------------------------------------------------ */
/* Sidebar scroll spy                                                  */
/* ------------------------------------------------------------------ */

function setupScrollSpy(reduced: boolean): void {
    const sections = document.querySelectorAll<HTMLElement>("[data-section]");
    if (!sections.length) return;

    const dock = document.getElementById("dock-cmd");
    const sigil = document.getElementById("dock-sigil");
    const hueEl = document.getElementById("bottom-hue");
    let dockTimer = 0;
    let currentActive = "";

    // (The dock sits at a fixed left inside the sidebar column - see
    // BaseLayout - so no measurement is needed.)

    /** Re-type the active section's command into the docked prompt. */
    const dockType = (section: HTMLElement) => {
        const cmd = section.dataset.cmd;
        if (!dock || cmd == null) return;
        if (sigil) sigil.style.color = section.dataset.cmdColor ?? "#a6e3a1";
        window.clearInterval(dockTimer);
        if (reduced) {
            dock.textContent = cmd;
            return;
        }
        let i = 0;
        dock.textContent = "";
        dockTimer = window.setInterval(() => {
            dock.textContent = cmd.slice(0, ++i);
            if (i >= cmd.length) window.clearInterval(dockTimer);
        }, 40);
    };
    cleanups.push(() => window.clearInterval(dockTimer));

    const setActive = (section: HTMLElement) => {
        const name = section.dataset.section ?? "";
        if (name === currentActive) return;
        currentActive = name;
        document.querySelectorAll<HTMLElement>("[data-spy]").forEach((link) => {
            link.classList.toggle("spy-active", link.dataset.spy === name);
        });
        // Lets CSS react to focus (e.g. ghost numerals brightening).
        sections.forEach((s) => s.classList.toggle("section-active", s === section));
        // The bottom hue adopts the chapter's accent (CSS cross-fades it);
        // the hero alone stays hue-free.
        if (hueEl) {
            if (section.dataset.cmdColor) {
                hueEl.style.setProperty("--hue-color", section.dataset.cmdColor);
            }
            hueEl.classList.toggle("hue-off", name === "home");
        }
        dockType(section);
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
    if (contactSec && lenis) {
        const onSpyScroll = () => {
            if (lenis && lenis.progress > 0.985) setActive(contactSec);
        };
        lenis.on("scroll", onSpyScroll);
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
        const per = Math.round(window.innerHeight * (desktop ? 0.9 : 0.75));
        const distance = (cards.length - 1) * per;
        // Cushion on entry and exit: pinned, but the pile holds still for
        // this much vertical scroll before/after the landing sequence.
        const buffer = Math.round(window.innerHeight * (desktop ? 0.45 : 0.3));
        // Cascade offset per card. Desktop: diagonal coaster pile (keep in
        // sync with .journey-stack CSS vars). Mobile: a slim vertical deck -
        // each landing card covers the pile, leaving a 10px edge per card.
        const offX = desktop ? parseFloat(section.dataset.offX ?? "26") : 0;
        const offY = desktop ? parseFloat(section.dataset.offY ?? "48") : 10;

        section.style.height = `${window.innerHeight + distance + buffer * 2}px`;
        const top = section.getBoundingClientRect().top + window.scrollY;
        result.push({
            section, cards, top, per, distance, buffer, offX, offY,
            vertical: !desktop,
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

    // Stage layers the engine flies across the pin: the chapter mark, the
    // docked headline, the finale arrow. Each is either absolute itself or
    // centered by an absolute wrapper; dropping that puts them in flow above
    // and below the cards, in DOM order.
    for (const el of document.querySelectorAll<HTMLElement>(
        "[data-cover-content], [data-hscroll-headline], [data-hscroll-arrow]",
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
        section.style.height = `${Math.round(window.innerHeight * (1 + dwell))}px`;
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
 * is complete it exits left as one object - leaving the arrow, which
 * rides in and docks. Mobile runs the cardstack deck instead.
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
    sigilEl: HTMLElement | null;
    arrowEl: HTMLElement | null;
    /** Arrow assembly parts: outline path (with cached length) + the
     *  label's individual letters (stamped on typewriter-style). */
    arrowPath: SVGPathElement | null;
    arrowLen: number;
    arrowLetters: SVGElement[];
    /** True viewport-centering correction: the full-bleed section sits
     *  half a scrollbar-width left of the viewport origin. */
    arrowShift: number;
    /** Docked x for headline and arrow: the pile's resting left edge. */
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
    /** Dwell on the assembled arrow before its own exit. */
    arrowDwell: number;
    buffer: number;
    top: number;
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
        // Generous read-time per landing card, a settle beat on the full
        // pile, one exit slide, and a dwell on the docked arrow.
        const per = Math.round(vh * 0.75);
        const settle = Math.round(vh * 0.3);
        // Generous exit: the pile's departure AND the arrow's assembly
        // (outline draw, flood, label stamp) are both scrubbed across it, so
        // this is the dial that sets how much scroll the whole assembly gets.
        // The label's share of that is widened separately in the scrub, so the
        // lettering slows without dragging out the draw and flood with it.
        const exitDist = Math.round(vh * 1.4);
        // Short dwell: the arrow does not need to sit finished on an empty
        // stage, and a long one leaves dead scroll between it and the grid it
        // points at. The grid climbs over its tail instead (see index.astro).
        const arrowDwell = Math.round(vh * 0.12);
        const buffer = Math.round(vh * 0.3);
        // Cascade offsets; keep in sync with the .hscroll-pin CSS calc.
        const offX = parseFloat(section.dataset.offX ?? "24");
        const offY = parseFloat(section.dataset.offY ?? "28");

        section.style.height =
            `${vh + buffer * 2 + cards.length * per + settle + exitDist + arrowDwell}px`;
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

        const arrowEl = section.querySelector<HTMLElement>("[data-hscroll-arrow]");
        const arrowPath = arrowEl?.querySelector<SVGPathElement>("path") ?? null;
        let arrowLen = 0;
        if (arrowPath) {
            arrowLen = arrowPath.getTotalLength();
            arrowPath.style.strokeDasharray = String(arrowLen);
        }

        result.push({
            section, track, cards, coverEl, coverRight,
            headline,
            headlineW: headline?.offsetWidth ?? 0,
            // Section space, not viewport space: the headline and arrow are
            // positioned inside the full-bleed section, which sits half a
            // scrollbar-width left of the viewport origin.
            dockRight: Math.round(trackRect.right - sectionRect.left),
            sigilEl: section.querySelector<HTMLElement>("[data-headline-sigil]"),
            arrowEl, arrowPath, arrowLen,
            arrowLetters: arrowEl
                ? Array.from(arrowEl.querySelectorAll<SVGElement>("text tspan"))
                : [],
            arrowShift: Math.round(
                (window.innerWidth - sectionRect.width) / 2 - sectionRect.left,
            ),
            dockLeft: Math.round(trackRect.left - sectionRect.left),
            offX, offY, per, settle, exitDist, arrowDwell, buffer, top,
        });
    }
    return result;
}

/* ------------------------------------------------------------------ */
/* Chapter covers (title slides that fade into the docked prompt)      */
/* ------------------------------------------------------------------ */

type Cover = { content: HTMLElement; top: number; dist: number };

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
        const top =
            section.getBoundingClientRect().top +
            window.scrollY -
            Math.round(window.innerHeight * 0.15);
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
 * - SETTLED SINK: a while after seating in the aligned position, every
 *   mark starts gliding downward very slowly as the scroll continues.
 * The contact panel's mark is fixed-positioned and stays put.
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
        .filter((el) => !el.closest(".contact-panel"))
        .map((el) => {
            const r = el.getBoundingClientRect();
            const journey = Boolean(el.closest(".journey-stack"));
            // "Settled" once the mark's top passes ~72% of the viewport -
            // i.e. moments after it enters. The journey mark sinks slower
            // and farther: its pin is long, so the glide gets to stretch.
            return {
                el,
                settleAt: Math.round(
                    r.top + window.scrollY - window.innerHeight * 0.72,
                ),
                entryLag: !journey,
                sinkSpeed: journey ? 0.025 : 0.04,
                sinkCap: journey ? 130 : 80,
            };
        });
}

/* ------------------------------------------------------------------ */
/* Scroll-driven frame update                                          */
/* ------------------------------------------------------------------ */

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
                const y = ((phase % viewportH) + viewportH) % viewportH;
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

    // Section walls: scroll momentum dies exactly at each section start; the
    // next gesture continues past it. No snap animation, just a stop.
    // Desktop only: braking scrollTo calls fight native touch momentum.
    const measureWalls = (): number[] =>
        !isDesktop() ? [] :
        Array.from(document.querySelectorAll<HTMLElement>("[data-snap]"))
            .map((el) => Math.round(el.getBoundingClientRect().top + window.scrollY))
            // The first section starts ~100px in; a wall there would halt the
            // very first scroll gesture for nothing.
            .filter((w) => w > window.innerHeight * 0.5)
            .sort((a, b) => a - b);
    let walls = reduced ? [] : measureWalls();
    let lastScroll = window.scrollY;
    let braking = false;

    // Reveal magnet: stopping mid-reveal leaves the page edge hanging over
    // the contact panel. Once the scroll RESTS inside the reveal band
    // (finger off, momentum spent), ease to the closer end - fully open or
    // fully closed. Never engages while the user is actively scrolling.
    if (!reduced && panel && lenis) {
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

        let restFrames = 0;
        let lastY = -1;
        magnetTick = () => {
            if (!lenis) return;
            if (touching || braking || anchorBypass) {
                restFrames = 0;
                return;
            }
            const y = window.scrollY;
            restFrames = Math.abs(y - lastY) < 0.5 ? restFrames + 1 : 0;
            lastY = y;
            // Fire exactly once per rest, after ~200ms of stillness.
            if (restFrames !== 12) return;
            const max =
                document.documentElement.scrollHeight - window.innerHeight;
            const bandStart = max - panel.offsetHeight;
            // Edges excluded: settled states must not re-trigger.
            if (y < bandStart + 32 || y > max - 32) return;
            lenis.scrollTo(y > (bandStart + max) / 2 ? max : bandStart, {
                duration: 0.8,
                easing: (t: number) => 1 - Math.pow(1 - t, 3),
            });
        };
        cleanups.push(() => (magnetTick = null));
    }

    // Frozen viewport height for all per-frame math. Reading innerHeight
    // live wobbles frame-by-frame while the mobile URL bar animates, which
    // makes every vh-derived position (hero scrub, deck cards) jitter
    // mid-pin. Refreshed only on a real remeasure.
    let viewportH = window.innerHeight || 1;

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
        viewportH = window.innerHeight || 1;
        applyPins();
        stacks = measureCardStacks();
        showcases = measureShowcases();
        markDrifts = measureMarkDrifts();
        holds = measureHolds();
        covers = measureCovers();
        walls = measureWalls();
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

    const onScroll = () => {
        const progress = lenis ? lenis.progress : nativeProgress();
        // The browser's actual offset, not Lenis's animated value: transforms
        // derived from it land in the same frame as the rendered scroll, so
        // pinned/held content doesn't shiver against the page.
        const scroll = window.scrollY;
        const vh = viewportH;

        // Wall coming up? Brake into the boundary with a short eased stop
        // instead of a dead halt. The crossing test looks ~8 frames ahead:
        // braking only after the fact overshoots the wall and yanks the page
        // back over it - a visible bounce at every section start under
        // momentum. (Skipped during anchor jumps.)
        if (lenis && !anchorBypass && !braking) {
            const projected = scroll + lenis.velocity * 8;
            for (const w of walls) {
                // 1px tolerance: a brake that lands a hair short of the wall
                // must not re-arm it against the very next gesture.
                const crossed =
                    (lastScroll < w - 1 && Math.max(scroll, projected) > w) ||
                    (lastScroll > w + 1 && Math.min(scroll, projected) < w);
                if (crossed) {
                    braking = true;
                    // Failsafe: a user gesture can interrupt the brake and
                    // swallow onComplete - never leave the walls disabled.
                    const failsafe = window.setTimeout(() => (braking = false), 700);
                    lenis.scrollTo(w, {
                        duration: 0.45,
                        easing: (t: number) => 1 - Math.pow(1 - t, 3),
                        onComplete: () => {
                            window.clearTimeout(failsafe);
                            braking = false;
                        },
                    });
                    break;
                }
            }
        }
        lastScroll = scroll;

        if (bar) bar.style.transform = `scaleX(${progress || 0})`;

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
            heroScrub.style.setProperty("--scrub", String(Math.pow(t, 1.5)));
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
        for (const el of focusEls) {
            const r = el.getBoundingClientRect();
            if (r.bottom < -150 || r.top > vh + 150) continue;
            const mid = r.top + r.height / 2;
            const delta = mid - vh / 2;
            const norm =
                delta >= 0
                    ? delta / (vh / 2)
                    : (-delta / (vh / 2)) * 0.4;
            const d = Math.max(0, Math.min(1, norm) - 0.25) / 0.75;
            el.style.opacity = (1 - d * 0.55).toFixed(3);
        }

        // Featured showcase pile (cushioned: waits out the entry buffer).
        // While inside one, the particle background lights up (CSS reacts
        // to the .in-showcase class).
        let inShowcase = false;
        for (const sc of showcases) {
            const local = scroll - sc.top - sc.buffer;
            const stackLen = sc.cards.length * sc.per;

            // Cards fly in from the right, one per scroll beat, and land
            // on the pile with a cascading offset.
            sc.cards.forEach((card, i) => {
                const t = Math.max(0, Math.min(1, (local - i * sc.per) / sc.per));
                const eased = 1 - Math.pow(1 - t, 3);
                const slide = (1 - eased) * (window.innerWidth * 1.05);
                card.style.transform =
                    `translate3d(${i * sc.offX + slide}px, ${i * sc.offY}px, 0)`;
            });

            // The first card's arrival pushes the chapter mark out left;
            // the fade is late and sharp so the exit reads as motion.
            if (sc.coverEl) {
                const t0 = Math.max(0, Math.min(1, local / sc.per));
                const eased = 1 - Math.pow(1 - t0, 3);
                const push = eased * (sc.coverRight + 60);
                sc.coverEl.style.transform = `translate3d(${-push}px, 0, 0)`;
                const rightEdge = sc.coverRight - push;
                const co = Math.max(0, Math.min(1, (rightEdge - 220) / 80));
                sc.coverEl.style.opacity = co.toFixed(3);
            }

            // Once the pile is complete (plus a settle beat) it exits left
            // as ONE object, at full opacity - pure motion; it passes
            // behind the frosted sidebar - while the arrow rides in to
            // take the stage.
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

            // The headline's // adopts the color of the arriving card
            // (CSS transition handles the fade between).
            if (sc.sigilEl && sc.cards.length) {
                const active = Math.max(
                    0,
                    Math.min(sc.cards.length - 1, Math.floor(local / sc.per)),
                );
                const fc = sc.cards[active].style.getPropertyValue("--fc").trim();
                if (fc) sc.sigilEl.style.color = `rgb(${fc})`;
            }

            // Finale arrow, assembled IN PLACE on the emptied stage and
            // scrubbed by the exit progress (fully reversible): once the
            // pile has cleared, the outline draws itself around the
            // silhouette, the fill floods in, and the label stamps on.
            // Then it exits the way it points: sliding down and fading as
            // the section releases into the grid.
            if (sc.arrowEl) {
                const draw = Math.max(0, Math.min(1, (easedE - 0.38) / 0.3));
                const flood = Math.max(0, Math.min(1, (easedE - 0.68) / 0.1));
                if (sc.arrowPath) {
                    sc.arrowPath.style.strokeDashoffset =
                        String(sc.arrowLen * (1 - draw));
                    sc.arrowPath.style.fillOpacity = flood.toFixed(3);
                    // The stroke STAYS. An SVG stroke is centered on the path,
                    // so it reaches half a stroke-width past the fill edge:
                    // fading it out shrinks the silhouette, and the outline you
                    // drew is visibly bigger than the arrow you end up with.
                    // Keeping it at full opacity in the fill's own color makes
                    // both states the same shape, and same-color-at-full-alpha
                    // leaves no rim to give it away.
                    sc.arrowPath.style.strokeOpacity = "1";
                }
                // Letters stamp on one at a time (M-O-R-E, then PROJECTS
                // running down the leg) - hard on/off, like a typewriter.
                // This is the widest window of the three phases: the label is
                // the part worth reading, and it landed too fast to register
                // when it shared a sliver of scroll with the flood.
                const stamp = Math.max(0, Math.min(1, (easedE - 0.78) / 0.22));
                const n = sc.arrowLetters.length || 1;
                sc.arrowLetters.forEach((letter, i) => {
                    letter.style.opacity = stamp * n >= i + 0.6 ? "1" : "0";
                });

                const e2 = Math.max(
                    0,
                    Math.min(
                        1,
                        (local - stackLen - sc.settle - sc.exitDist - sc.arrowDwell) /
                            sc.buffer,
                    ),
                );
                const eased2 = e2 * e2 * (3 - 2 * e2);
                // Layout centers the arrow (arrowShift trues it up against
                // the viewport); the engine only drives its exit.
                sc.arrowEl.style.transform =
                    `translate3d(${sc.arrowShift}px, ${(eased2 * vh * 0.35).toFixed(1)}px, 0)`;
                sc.arrowEl.style.opacity = (1 - eased2).toFixed(3);
            }

            if (
                local > -vh * 0.2 &&
                local < stackLen + sc.settle + sc.exitDist + sc.buffer
            ) {
                inShowcase = true;
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
            s.cards.forEach((card, i) => {
                const rx = i * s.offX;
                const ry = i * s.offY;
                if (i === 0) {
                    card.style.transform = `translate3d(0, 0, 0)`;
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

function tickMarquee(): void {
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
    marquee.offset += 1.4 + Math.min(Math.abs(velocity) * 0.25, 10);

    // Skew with scroll velocity, ease back to rest.
    const targetSkew = Math.max(-10, Math.min(10, velocity * 0.35));
    marquee.skew += (targetSkew - marquee.skew) * 0.12;

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
            if (lenis) {
                // Walls stand down for the jump (safety timeout in case the
                // scroll gets interrupted and onComplete never fires).
                anchorBypass = true;
                const failsafe = window.setTimeout(() => (anchorBypass = false), 2000);
                lenis.scrollTo(target, {
                    offset: 0,
                    onComplete: () => {
                        window.clearTimeout(failsafe);
                        anchorBypass = false;
                    },
                });
            } else {
                target.scrollIntoView();
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
    const reduced = prefersReducedMotion();
    document.documentElement.classList.toggle("reduced-motion", reduced);

    if (!reduced) {
        // Low lerp + slightly damped wheel = heavier, more deliberate glide.
        lenis = new Lenis({ lerp: 0.065, smoothWheel: true, wheelMultiplier: 0.85 });

        const raf = (time: number) => {
            lenis?.raf(time);
            tickMarquee();
            magnetTick?.();
            parallaxTick?.();
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
    setupTypedPrompts(reduced);
    setupScrollSpy(reduced);
    setupAnchors();
    // Applies pin/stack heights and registers the section walls against the
    // final stretched layout.
    bindScrollDriven(reduced);
}

/** Bind once; ClientRouter fires page-load on initial load and every navigation. */
export function wireSmoothScroll(): void {
    document.addEventListener("astro:page-load", initSmoothScroll);
    document.addEventListener("astro:before-swap", destroySmoothScroll);
}
