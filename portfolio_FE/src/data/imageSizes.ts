/**
 * Intrinsic pixel size of every project screenshot, keyed by public path.
 * The <img> tags carry width/height from here so the browser reserves the
 * box before the file arrives: no layout shift while a card's media band
 * fills in, which matters inside the pinned decks where a late jump is
 * very visible.
 */
const IMAGE_SIZES: Record<string, readonly [number, number]> = {
    "/pictures/ble-app-1.webp": [593, 569],
    "/pictures/ble-app-2.webp": [608, 981],
    "/pictures/fleetz.webp": [1521, 936],
    "/pictures/noiz.webp": [923, 624],
    "/pictures/notez-global.webp": [1602, 1002],
    "/pictures/notez-local.webp": [1602, 1004],
    "/pictures/pinz.webp": [1521, 936],
    "/pictures/portfolio-1.webp": [1714, 1042],
    "/pictures/portfolio-2.webp": [1800, 1630],
    "/pictures/portfolio-3.webp": [762, 922],
    "/pictures/release-pipeline.webp": [1600, 928],
    "/pictures/repoz.webp": [1521, 936],
    "/pictures/stdz.webp": [1521, 936],
    "/pictures/todoz-global.webp": [1604, 1002],
    "/pictures/todoz-local.webp": [1606, 1000],
    "/pictures/wm-1.webp": [2184, 2044],
    "/pictures/wm-2.webp": [944, 890],
    "/pictures/wtp-1.webp": [2568, 1714],
    "/pictures/wtp-2.webp": [1958, 1628],
    "/pictures/wtp-3.webp": [1954, 1494],
    "/pictures/zalary.webp": [1521, 936],
};

export function imageSize(src: string): { width?: number; height?: number } {
    const size = IMAGE_SIZES[src];
    return size ? { width: size[0], height: size[1] } : {};
}
