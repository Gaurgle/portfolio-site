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

// The sky's own two inks: cloud white and the cloud-shade accent
const SKY_INKS = ["rgb(240 243 247)", "rgb(184 197 214)"];
const TYPES: SketchType[] = ["underline", "box", "circle", "bracket"];

const reducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** Touch screens have no hover to answer to. */
export const canHover = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

/** Drawn, ms (the draw itself included). */
export const TIMER_HOLD = 3200;
/** Undrawn, ms, before it draws again. */
const TIMER_REST = 2400;

/**
 * Touch screens: the sketch draws itself on a timer instead of on hover.
 * While `target` is well on screen (and `ready`, e.g. its passage in focus)
 * it draws in, holds, draws out, rests, and goes again; each starts at its
 * own small offset so neighbours never pulse in step. Off screen it draws
 * out and waits. Under reduced motion it draws once and stays. `hold` is
 * how long it stays drawn, ms. Returns a cleanup function.
 */
export function sketchOnTimer(
  target: Element,
  show: () => void,
  hide: () => void,
  ready: () => boolean = () => true,
  hold: number = TIMER_HOLD,
): () => void {
  let visible = false;
  let drawn = false;
  let timer = 0;
  // Leaving `ready` mid-hold (a passage flying on) draws it out at once,
  // not when the hold would have ended.
  const watch = window.setInterval(() => {
    if (!drawn || ready()) return;
    hide();
    drawn = false;
    clearTimeout(timer);
    timer = visible ? window.setTimeout(step, 400) : 0;
  }, 100);
  const step = () => {
    timer = 0;
    if (!visible) return;
    if (!ready()) {
      if (drawn) hide();
      drawn = false;
      timer = window.setTimeout(step, 400);
      return;
    }
    if (drawn) {
      hide();
      drawn = false;
      timer = window.setTimeout(step, TIMER_REST);
    } else {
      show();
      drawn = true;
      if (!reducedMotion()) timer = window.setTimeout(step, hold);
    }
  };
  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      clearTimeout(timer);
      timer = 0;
      if (visible) timer = window.setTimeout(step, 300 + Math.random() * 900);
      else if (drawn) {
        hide();
        drawn = false;
      }
    },
    { threshold: 0.6 },
  );
  io.observe(target);
  return () => {
    io.disconnect();
    clearTimeout(timer);
    clearInterval(watch);
  };
}

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
 * Sketch a rough-notation annotation that draws in on hover and reverses on
 * leave; on touch screens it draws on a timer instead (sketchOnTimer).
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
    palette = SKY_INKS,
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
    // rough-notation would redraw on every resize (each move of a phone's
    // browser bar), undashed: the stroke shown at once. Placed once instead.
    (current as { detachListeners?: () => void }).detachListeners?.();
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

  if (!canHover()) {
    const stop = sketchOnTimer(region, onEnter, onLeave);
    return () => {
      stop();
      clearTimeout(removeTimer);
      current?.remove();
    };
  }

  region.addEventListener("mouseenter", onEnter);
  region.addEventListener("mouseleave", onLeave);

  return () => {
    region.removeEventListener("mouseenter", onEnter);
    region.removeEventListener("mouseleave", onLeave);
    clearTimeout(removeTimer);
    current?.remove();
  };
}
