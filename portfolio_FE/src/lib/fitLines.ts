/**
 * Clamps `text` to as many whole lines as fit, so a fixed-height card never
 * scrolls and never cuts a line in half. `box` is the fixed-height element
 * that must not overflow: `text` itself, its parent or a further ancestor.
 * The count lands in `--fit-lines` for the text's `-webkit-line-clamp`.
 * Re-fits when the box resizes (rotation) and once the fonts have landed.
 * Returns a cleanup.
 */
export function fitLines(text: HTMLElement, box: HTMLElement, max: number): () => void {
    const fit = () => {
        let lines = max;
        text.style.setProperty("--fit-lines", String(lines));
        while (lines > 1 && box.scrollHeight > box.clientHeight + 1) {
            text.style.setProperty("--fit-lines", String(--lines));
        }
    };
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
}
