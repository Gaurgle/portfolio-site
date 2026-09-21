import { annotate } from "rough-notation";

export type SketchType =
  | "underline"
  | "box"
  | "circle"
  | "bracket"
  | "highlight"
  | "strike-through"
  | "crossed-off";

export interface SketchOptions {
  /** Fixed color (any CSS color). Omit together with `randomize` to roll from `palette`. */
  color?: string;
  /** Fixed annotation type. Omit with `randomize` to roll from `types`. */
  type?: SketchType;
  /** Roll a fresh type + color on every hover. */
  randomize?: boolean;
  strokeWidth?: number;
  padding?: number;
  drawMs?: number;
  undrawMs?: number;
  palette?: string[];
  types?: SketchType[];
}

// Catppuccin Mocha accents
const CATPPUCCIN = ["#9d8cff", "#46beff", "#8dffb0", "#ffb84d", "#ff6b8b", "#3fe8d2"];
const TYPES: SketchType[] = ["underline", "box", "circle", "bracket"];

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// rough-notation appends one <svg.rough-annotation> per annotation to the element's parent
function pathsOf(el: HTMLElement): SVGPathElement[] {
  const parent = el.parentElement;
  if (!parent) return [];
  const svgs = parent.querySelectorAll<SVGSVGElement>("svg.rough-annotation");
  const svg = svgs[svgs.length - 1];
  return svg ? Array.from(svg.querySelectorAll("path")) : [];
}

// Dash the whole stroke and start fully retracted (hidden)
function prime(paths: SVGPathElement[]): void {
  paths.forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = String(len);
    p.style.strokeDashoffset = String(len);
  });
}

/**
 * Sketch a rough-notation annotation that draws in on hover and reverses on leave.
 * We disable rough-notation's own animation and drive `stroke-dashoffset` ourselves,
 * so the draw can play backwards. Returns a cleanup function.
 */
export function sketchOnHover(el: HTMLElement, opts: SketchOptions = {}): () => void {
  const {
    color,
    type,
    randomize = false,
    strokeWidth = 1.6,
    padding = 4,
    drawMs = 500,
    undrawMs = 260,
    palette = CATPPUCCIN,
    types = TYPES,
  } = opts;

  const region = (el.closest("a") as HTMLElement) || el; // hover the whole link, not just the text
  const inMs = reducedMotion() ? 0 : drawMs;
  const outMs = reducedMotion() ? 0 : undrawMs;

  let current: ReturnType<typeof annotate> | null = null;
  let removeTimer = 0;

  const build = () => {
    current = annotate(el, {
      type: type ?? pick(types),
      color: color ?? pick(palette),
      strokeWidth,
      padding,
      multiline: true,
      animate: false,
    });
    current.show(); // render the rough strokes statically
    prime(pathsOf(el));
  };

  if (!randomize) build(); // fixed style: build once up front, hidden

  const onEnter = () => {
    clearTimeout(removeTimer);
    if (randomize) {
      current?.remove();
      build(); // fresh style + color each hover
    }
    const paths = pathsOf(el);
    requestAnimationFrame(() => {
      paths.forEach((p) => {
        p.style.transition = `stroke-dashoffset ${inMs}ms ease`;
        p.style.strokeDashoffset = "0";
      });
    });
  };

  const onLeave = () => {
    const paths = pathsOf(el);
    paths.forEach((p) => {
      const len = p.style.strokeDasharray || String(p.getTotalLength());
      p.style.transition = `stroke-dashoffset ${outMs}ms ease-in`;
      p.style.strokeDashoffset = len; // retract back along the path
    });
    if (randomize) {
      removeTimer = window.setTimeout(() => {
        current?.remove();
        current = null;
      }, outMs + 60);
    }
  };

  region.addEventListener("mouseenter", onEnter);
  region.addEventListener("mouseleave", onLeave);

  return () => {
    region.removeEventListener("mouseenter", onEnter);
    region.removeEventListener("mouseleave", onLeave);
    clearTimeout(removeTimer);
    current?.remove();
  };
}
