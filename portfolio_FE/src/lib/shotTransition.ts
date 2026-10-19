/**
 * Shared-element transition for the screenshot lightboxes: the picture
 * grows out of its card into the lightbox, and closing sends it back.
 *
 * Uses the View Transitions API where the browser has it (feature-detected:
 * Safari's support varies); anywhere else, and under reduced motion, the
 * lightbox simply opens and closes as it always has. global.css styles the
 * transition (html.shot-transition, ::view-transition-*(shot|shot-scrim)).
 *
 * Interruptible: a swap asked for while one is still running does not wait
 * for it. The running transition plays back from wherever it has got to,
 * and the new DOM state is put in place the moment it arrives back, in the
 * same frame its animations finish. (Not before: the pair it was heading
 * for has to stay rendered until then, or the browser abandons it.)
 */

/** The elements that take part: the picture, and the lightbox's scrim. */
export type ShotPair = { shot: HTMLElement | null; scrim?: HTMLElement | null };

/** The open lightbox's pair (both lightboxes mark them with these). */
export const lightboxPair = (): ShotPair => ({
    shot: document.querySelector<HTMLElement>("[data-shot]"),
    scrim: document.querySelector<HTMLElement>("[data-shot-scrim]"),
});

let running: ViewTransition | null = null;
/** The picture the running transition is leaving, so a repeated request
 *  (a double click) is not mistaken for a reversal. */
let leaving: HTMLElement | null = null;

function name(pair: ShotPair, on: boolean): void {
    pair.shot?.style.setProperty("view-transition-name", on ? "shot" : "");
    pair.scrim?.style.setProperty("view-transition-name", on ? "shot-scrim" : "");
}

/**
 * Runs `update` (which opens or closes a lightbox and returns the pair that
 * now shows) as a transition from `before`, the pair showing now.
 */
export function swapShot(before: ShotPair, update: () => ShotPair): void {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || typeof document.startViewTransition !== "function") {
        update();
        return;
    }

    if (running) {
        if (before.shot === leaving) return;
        leaving = before.shot;
        const reversing = running;
        reversing.ready
            .then(() => {
                const playing = document.getAnimations().filter((animation) =>
                    (animation.effect as KeyframeEffect | null)?.pseudoElement?.startsWith("::view-transition"));
                playing.forEach((animation) => animation.reverse());
                return Promise.all(playing.map((animation) => animation.finished));
            })
            .catch(() => reversing.finished)
            .finally(update);
        return;
    }

    const root = document.documentElement;
    root.classList.add("shot-transition");
    leaving = before.shot;
    name(before, true);
    let after: ShotPair = { shot: null };
    const transition = document.startViewTransition(() => {
        name(before, false);
        after = update();
        name(after, true);
    });
    running = transition;
    transition.finished.finally(() => {
        name(after, false);
        if (running === transition) running = null;
        root.classList.remove("shot-transition");
    });
}
