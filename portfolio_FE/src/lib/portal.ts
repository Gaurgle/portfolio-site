/**
 * The portal: the sidebar's right edge, on desktop. Whatever content
 * reaches it (type, pictures, icons, the chapter marks; never the sky or
 * the starfield) is engulfed as it passes through a portal of liquid
 * chrome. The border is the surface of a world whose gravity points into
 * it, sideways, unrelated to the page's up and down: the content pours its
 * light and colour into it as it crosses, and two layers rise off the
 * surface. One is molten silver: heavy, splashed back out by the content's
 * impact, arcing and falling back onto the border. The other is a solar
 * flare: light, buoyant plasma that lifts off in prominences, loops over
 * and thins away. It pools wider on the content side, so what crosses is
 * swallowed, not traced. At the border it wears the content's colours;
 * further out they turn to silver and banded chrome (orange, rose, violet,
 * electric blue, cyan: no green or yellow, so it never reads as a
 * rainbow). The threshold itself never moves (clouds.ts gives a cloud cut
 * off by it a faint, buzzing seam of the same chrome).
 *
 * The fluid is a small stable-fluids simulation (Stam, "Stable Fluids",
 * 1999): semi-Lagrangian advection, a viscosity blur, and a pressure solve
 * that keeps the flow incompressible, which is what makes it curl the way
 * real fluids do. It keeps moving and dies out on its own, so the burn
 * completes even if the page stops with the content half way through.
 * The content itself is left alone.
 *
 * Desktop only, never under reduced motion. One WebGL canvas over the
 * edge, simulated at half resolution, running only while something is at
 * the edge or still glowing. Elements are found once; an
 * IntersectionObserver keeps the few near the edge in view, so the page is
 * not measured as a whole every frame.
 */

/** Never flares: the sky, the starfield and other decoration, the ROOS
 *  mark, and the chrome the portal belongs to. */
const EXCLUDE = [
    "#sidebar", "header", "canvas", "script", "style", "noscript",
    ".particle-layers", ".portal-edge", ".cm-fringe",
    ".hero-mark",
    "[data-sky]", "#secret-terminal",
].join(", ");
/** How far of the content side is read, CSS px. */
const AHEAD = 24;
/** How far the fluid can reach out over the content, CSS px. */
const REACH = 44;
/** The simulation's resolution relative to the canvas. */
const SIM_SCALE = 0.5;
/** The two layers: how each is pushed (force shader), how thick it is,
 *  how much of the content it takes in, how much of it survives each step
 *  at the border and far off, and how many pressure iterations it gets
 *  (more is more fluid, and more work). */
const METAL = {
    // Heavy: launched hard, pulled back hard, keeps its momentum, splashes.
    force: { launch: .024, pull: .03, rise: .0016, vortex: .2, splash: .025, churn: .008, hold: .95 },
    thick: .6, amount: .07, keep: [.962, .82], pressureSteps: 16,
};
const FLARE = {
    // Light: buoyant, barely held back, curls, and thins away quickly.
    force: { launch: .02, pull: .014, rise: .0008, vortex: .3, splash: .008, churn: .015, hold: .92 },
    thick: .9, amount: .045, keep: [.945, .8], pressureSteps: 8,
};
/** Seconds the fluid is kept alive after the last content left the edge;
 *  over the last FADE of them it fades to nothing before it stops. */
const LINGER = 1.4;
const FADE = 0.7;

const vertexSource = `#version 300 es
in vec2 position;
out vec2 uv;
void main() { uv = position * .5 + .5; gl_Position = vec4(position, 0., 1.); }
`;

/** Shared by the passes: noise, and where a pixel sits relative to the edge. */
const common = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 color;
uniform vec2 texel;   // one simulation cell, in uv
uniform vec2 view;    // the canvas, CSS px
uniform float edge;   // the edge's x, CSS px from the canvas's left
uniform float time;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 w = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), w.x),
               mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), w.x), w.y);
}
float luma(vec3 c) { return dot(c, vec3(.2126, .7152, .0722)); }
// px right of the edge (negative inside the sidebar), and px from the top.
float px() { return uv.x * view.x - edge; }
float py() { return (1. - uv.y) * view.y; }
`;

/** Forces, with gravity turned sideways: the border is the surface, "up"
 *  is away from it. Light rises off the surface where it is brightest and
 *  gravity pulls it back, so plumes arc out and fall in; how hard each
 *  stretch erupts drifts slowly. The content's momentum drags it in on the
 *  sidebar side and splashes it out on the other. Velocities are in cells
 *  per step. Each layer brings its own weights (METAL, FLARE). */
const forceSource = common + `
uniform sampler2D velocity;
uniform sampler2D dye;
uniform sampler2D curl;
uniform float speed; // how fast the content is moving into the border, px per frame
uniform float launch, pull, rise, vortex, splash, churn, hold;
void main() {
    vec2 v = texture(velocity, uv).xy;
    float light = luma(texture(dye, uv).rgb);
    float x = px(), y = py();
    // Eruptions: the light lifts off the surface, harder in some places, and
    // at a slant that drifts along the border, so plumes leave as arcs, not
    // as bars.
    float erupt = .3 + 1.4 * pow(noise(vec2(y * .018, time * .35)), 2.);
    float slant = (noise(vec2(y * .025 + 7.3, time * .25)) - .5) * 1.8;
    v += light * launch * erupt * vec2(cos(slant), sin(slant));
    // Shear above the surface: the further a plume rises, the more it is
    // bent along the border, one way here and the other there.
    v.y += (noise(vec2(y * .012 - 3.1, time * .2)) - .5) * .03 * smoothstep(0., 16., x);
    // Gravity, toward the surface from either side, harder the higher the
    // liquid has risen, so arcs fall back in instead of spreading out;
    // lighter on the sidebar side, so what is dragged in stays in a while.
    v.x -= sign(x) * (x > 0. ? pull + x * rise : .006) * smoothstep(0., 8., abs(x));
    // Vorticity confinement: the swirls the solver would smear away are
    // given back, so the plumes curl over as they fall.
    float cl = texture(curl, uv - vec2(texel.x, 0.)).x, cr = texture(curl, uv + vec2(texel.x, 0.)).x;
    float cb = texture(curl, uv - vec2(0., texel.y)).x, ct = texture(curl, uv + vec2(0., texel.y)).x;
    vec2 toward = vec2(abs(ct) - abs(cb), abs(cr) - abs(cl));
    v += toward / (length(toward) + 1e-5) * texture(curl, uv).x * vec2(1., -1.) * vortex;
    // The crossing content drags the liquid in with it on the sidebar side,
    // and its impact splashes the liquid back out on the content side, more
    // in some places than others.
    float hit = speed * exp(-x * x / 150.);
    v.x -= hit * .15 * smoothstep(4., -4., x);
    v.x += hit * light * splash * smoothstep(-4., 4., x) * (.3 + noise(vec2(y * .05, time * 2.)));
    // A faint churn, so nothing settles into stillness.
    vec2 q = vec2(x * .035, y * .02);
    v += (vec2(noise(q + vec2(time * .12, 0.)), noise(q + vec2(5.2, time * .1))) - .5) * churn;
    color = vec4(v * hold, 0., 1.);
}
`;

/** How the flow turns at each cell. */
const curlSource = common + `
uniform sampler2D velocity;
void main() {
    float l = texture(velocity, uv - vec2(texel.x, 0.)).y, r = texture(velocity, uv + vec2(texel.x, 0.)).y;
    float b = texture(velocity, uv - vec2(0., texel.y)).x, t = texture(velocity, uv + vec2(0., texel.y)).x;
    color = vec4(.5 * (r - l - t + b), 0., 0., 1.);
}
`;

/** The content pours into the fluid along a soft band on the threshold. */
const injectSource = common + `
uniform sampler2D dye;
uniform sampler2D content; // what lies just right of the edge, now
uniform float ahead;
uniform float amount;
vec3 lit(float x, float y) {
    vec4 c = texture(content, vec2(clamp(x, 0., ahead - 1.) / ahead, y / view.y));
    return c.rgb * c.a;
}
void main() {
    vec3 d = texture(dye, uv).rgb;
    float x = px(), y = py();
    // The content in contact with the border, diffused over several rows,
    // so a line of type pours in as a stream, not a bar.
    vec3 c = lit(1.5, y) * .25 + (lit(1.5, y - 2.) + lit(1.5, y + 2.)) * .17
        + (lit(3., y - 4.) + lit(3., y + 4.)) * .1 + lit(5., y) * .21;
    // A soft band across the threshold, no seam at it: wide over the
    // content, which is engulfed, narrow into the sidebar.
    float spread = x > 0. ? 12. : 9.;
    float band = exp(-x * x / (2. * spread * spread));
    d += c * band * amount;
    color = vec4(min(d, vec3(1.6)), 1.);
}
`;

const advectSource = common + `
uniform sampler2D velocity;
uniform sampler2D source;
uniform float near, far; // how much survives each step, at the edge and far off
void main() {
    vec2 from = uv - texture(velocity, uv).xy * texel;
    // It fades quickly away from the edge, never getting far: soonest out
    // over the content, later on the sidebar side it was dragged into.
    float x = px();
    float keep = mix(near, far, x > 0. ? smoothstep(3., 28., x) : smoothstep(4., 32., -x));
    color = texture(source, from) * keep;
}
`;

/** Viscosity: each cell's motion drawn toward its neighbours', by `thick`. */
const viscositySource = common + `
uniform sampler2D velocity;
uniform float thick;
void main() {
    vec2 v = texture(velocity, uv).xy;
    vec2 around = texture(velocity, uv + vec2(texel.x, 0.)).xy + texture(velocity, uv - vec2(texel.x, 0.)).xy
        + texture(velocity, uv + vec2(0., texel.y)).xy + texture(velocity, uv - vec2(0., texel.y)).xy;
    color = vec4(mix(v, around * .25, thick), 0., 1.);
}
`;

const divergenceSource = common + `
uniform sampler2D velocity;
void main() {
    float l = texture(velocity, uv - vec2(texel.x, 0.)).x, r = texture(velocity, uv + vec2(texel.x, 0.)).x;
    float b = texture(velocity, uv - vec2(0., texel.y)).y, t = texture(velocity, uv + vec2(0., texel.y)).y;
    color = vec4(.5 * (r - l + t - b), 0., 0., 1.);
}
`;

const pressureSource = common + `
uniform sampler2D pressure;
uniform sampler2D divergence;
void main() {
    float l = texture(pressure, uv - vec2(texel.x, 0.)).x, r = texture(pressure, uv + vec2(texel.x, 0.)).x;
    float b = texture(pressure, uv - vec2(0., texel.y)).x, t = texture(pressure, uv + vec2(0., texel.y)).x;
    color = vec4((l + r + b + t - texture(divergence, uv).x) * .25, 0., 0., 1.);
}
`;

const gradientSource = common + `
uniform sampler2D pressure;
uniform sampler2D velocity;
void main() {
    float l = texture(pressure, uv - vec2(texel.x, 0.)).x, r = texture(pressure, uv + vec2(texel.x, 0.)).x;
    float b = texture(pressure, uv - vec2(0., texel.y)).x, t = texture(pressure, uv + vec2(0., texel.y)).x;
    color = vec4(texture(velocity, uv).xy - .5 * vec2(r - l, t - b), 0., 1.);
}
`;

/** What is seen: molten silver, with the flare glowing around it. The dye's density is the liquid's depth;
 *  where it is deep enough there is a surface, with a soft but defined edge
 *  (surface tension), lit like a mirror: the room reflected in it, one
 *  sharp highlight, a bright Fresnel rim where it curves away, and the
 *  chrome set tinting its reflections. At the border it still wears the
 *  content's colours. */
const displaySource = common + `
uniform sampler2D dye;
uniform sampler2D flare;
// The dye smoothed over a few cells, so the liquid reads as one body rather
// than as fine detail.
vec3 soft(vec2 at) {
    vec2 o = texel * 1.6;
    return texture(dye, at).rgb * .4 + (texture(dye, at + vec2(o.x, 0.)).rgb + texture(dye, at - vec2(o.x, 0.)).rgb
        + texture(dye, at + vec2(0., o.y)).rgb + texture(dye, at - vec2(0., o.y)).rgb) * .15;
}
vec3 chrome(float h) {
    const vec3 stops[5] = vec3[5](vec3(1., .42, .06), vec3(1., .16, .5),
        vec3(.58, .2, 1.), vec3(.16, .44, 1.), vec3(.1, .92, 1.));
    float k = fract(h) * 5.;
    int i = int(k);
    return mix(stops[i], stops[(i + 1) % 5], smoothstep(0., 1., fract(k)));
}
void main() {
    vec2 at = uv;
    vec2 split = vec2(texel.x * 1.2, 0.);
    vec3 d = vec3(soft(at + split).r, soft(at).g, soft(at - split).b);
    float depth = luma(d);
    float x = abs(px()), y = py();
    float h = x * .014 + y * .0011 + time * .02;
    // The surface: where the liquid is deep enough to hold together.
    float body = smoothstep(.05, .2, depth);
    // Its slope, from the depth around it.
    vec2 dx = vec2(texel.x * 2., 0.), dy = vec2(0., texel.y * 2.);
    vec2 slope = vec2(luma(soft(at + dx)) - luma(soft(at - dx)), luma(soft(at + dy)) - luma(soft(at - dy)));
    vec3 n = normalize(vec3(-slope * 7., 1.));
    vec3 r = reflect(vec3(0., 0., -1.), n);
    // The room it reflects: a bright sky above, a dark floor, a soft
    // horizon, tinted by the chrome set as it turns.
    float room = smoothstep(-.6, .7, r.y + r.x * .3);
    vec3 silver = mix(vec3(.05, .06, .08), vec3(.92, .95, 1.), room);
    silver = mix(silver, silver * chrome(h + r.x * .4 + r.y * .25) * 1.5, .35);
    // One sharp highlight, and the Fresnel rim where the surface curves away.
    float spec = pow(max(dot(r, normalize(vec3(-.4, .6, .7))), 0.), 60.);
    float fresnel = pow(1. - n.z, 2.);
    vec3 metal = silver * (.55 + .45 * depth) + spec * 1.4 + chrome(h + .3) * fresnel * .8;
    // At the border it wears the content's colours; away from it, silver.
    vec3 c = mix(d * 1.2, metal, smoothstep(2., 18., x) * .9) * body;
    // Thin liquid short of a surface: a faint sheen, so nothing switches.
    c += d * .25 * (1. - body);
    // The flare: thin plasma glowing in the chrome set, its colours split a
    // little, behind the metal and out around it.
    vec3 f = vec3(texture(flare, uv + split * 2.).r, texture(flare, uv).g, texture(flare, uv - split * 2.).b);
    float glow = luma(f);
    vec3 plasma = mix(f, chrome(h + glow * 1.5) * glow * 1.6, smoothstep(2., 14., x) * .85);
    c += plasma * (1. - body * .7);
    float rim = fresnel * body;
    // Film grain in clumps of a couple of pixels, new every frame.
    vec2 clump = floor(gl_FragCoord.xy / 2.);
    c *= .93 + .14 * hash(clump + fract(time * 7.13));
    // Glitch sparkles: rare specks that fade in and out, on the liquid and
    // most of all along its rim.
    float beat = floor(time * 9.);
    float spark = step(.996 - rim * .015, hash(clump * 1.7 + beat));
    float twinkle = sin(fract(time * 9.) * 3.1416);
    c += chrome(h + hash(clump + 3.1) * .6) * spark * twinkle * (depth * 2.5 + rim * 3.);
    color = vec4(1. - exp(-c * .75), 1.);
}
`;

function compile(gl: WebGL2RenderingContext, fragment: string): WebGLProgram | null {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type);
        if (!shader || !program) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn("portal shader:", gl.getShaderInfoLog(shader));
            return null;
        }
        gl.attachShader(program, shader);
    }
    if (!program) return null;
    gl.bindAttribLocation(program, 0, "position");
    gl.linkProgram(program);
    return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

/** Type, redrawn in its colour where the page sets it, word by word, into a
 *  canvas the size of its box. Only the element's own text: its child
 *  elements are found and drawn on their own. */
function rasterizeText(el: Element): HTMLCanvasElement | null {
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return null;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(box.width) + 4;
    canvas.height = Math.ceil(box.height) + 4;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const style = getComputedStyle(el);
    ctx.fillStyle = style.color;
    ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const upper = style.textTransform === "uppercase";
    const range = document.createRange();
    for (const node of Array.from(el.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const text = node.textContent ?? "";
        for (const m of text.matchAll(/\S+/g)) {
            range.setStart(node, m.index ?? 0);
            range.setEnd(node, (m.index ?? 0) + m[0].length);
            const r = range.getBoundingClientRect();
            if (r.width < 1) continue;
            const word = upper ? m[0].toUpperCase() : m[0];
            // Fitted to the word's box, so a different width axis (or an
            // svg's stretched lettering) still lands where the page has it.
            const measured = ctx.measureText(word).width || r.width;
            ctx.save();
            ctx.translate(r.left - box.left, r.bottom - box.top - r.height * 0.22);
            ctx.scale(r.width / measured, 1);
            ctx.fillText(word, 0, 0);
            ctx.restore();
        }
    }
    return canvas;
}

/** An inline icon, drawn white, handed over once it has loaded. */
function rasterizeIcon(svg: SVGSVGElement, done: (img: HTMLImageElement) => void): void {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    clone.setAttribute("width", String(Math.max(1, Math.round(box.width))));
    clone.setAttribute("height", String(Math.max(1, Math.round(box.height))));
    clone.setAttribute("style", "color:#fff");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const img = new Image();
    img.onload = () => done(img);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
}

/** Where an object-contain picture actually draws inside its box. */
function containedRect(img: HTMLImageElement, r: DOMRect) {
    if (getComputedStyle(img).objectFit !== "contain") return { x: r.left, y: r.top, w: r.width, h: r.height };
    const iw = img.naturalWidth || r.width, ih = img.naturalHeight || r.height;
    const scale = Math.min(r.width / iw, r.height / ih);
    const w = iw * scale, h = ih * scale;
    return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
}

/** Everything that can flare: pictures, icons, and every element with
 *  text of its own (svg text included), outside the excluded layers. */
function findContent(): Element[] {
    return Array.from(document.body.querySelectorAll("*")).filter((el) => {
        if (el.closest(EXCLUDE)) return false;
        if (el instanceof HTMLImageElement) return true;
        if (el instanceof SVGSVGElement) return !el.querySelector("text");
        if (el instanceof SVGElement && el.tagName !== "text") return false;
        return Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
    });
}

type Target = { texture: WebGLTexture; frame: WebGLFramebuffer };

/** Mounts the portal; returns its teardown. */
export function setupPortal(): () => void {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return () => {};

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.className = "portal-edge";
    document.body.appendChild(canvas);
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false });
    // The content strip just right of the edge, redrawn every frame.
    const strip = document.createElement("canvas");
    const stripCtx = strip.getContext("2d");
    const programs = gl && {
        curl: compile(gl, curlSource),
        force: compile(gl, forceSource),
        inject: compile(gl, injectSource),
        advect: compile(gl, advectSource),
        viscosity: compile(gl, viscositySource),
        divergence: compile(gl, divergenceSource),
        pressure: compile(gl, pressureSource),
        gradient: compile(gl, gradientSource),
        display: compile(gl, displaySource),
    };
    if (!gl || !programs || Object.values(programs).some((p) => !p) || !stripCtx) {
        canvas.remove();
        return () => {};
    }
    const p = programs as Record<keyof typeof programs, WebGLProgram>;
    // Half-float fields where the browser can render to them; bytes if not.
    const floats = !!gl.getExtension("EXT_color_buffer_float");
    const format = floats ? gl.RGBA16F : gl.RGBA8;
    const type = floats ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const makeTexture = () => {
        const t = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
    };
    const makeTarget = (): Target => {
        const texture = makeTexture();
        const frame = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, frame);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
        return { texture, frame };
    };
    /** A field written by reading its other half: swapped after each pass. */
    const pair = () => {
        const field = { read: makeTarget(), write: makeTarget(), swap: () => {
            [field.read, field.write] = [field.write, field.read];
        } };
        return field;
    };
    // Each layer keeps its own pressure, the next frame's first guess; they
    // share the divergence scratch field.
    const metal = { velocity: pair(), dye: pair(), pressure: pair(), ...METAL };
    const flare = { velocity: pair(), dye: pair(), pressure: pair(), ...FLARE };
    const divergence = makeTarget();
    const contentTexture = makeTexture();
    const fields = [metal, flare].flatMap((l) => [l.velocity, l.dye, l.pressure].flatMap((f) => [f.read, f.write]))
        .concat(divergence);

    let edge = 0, width = 0, height = 0, simW = 1, simH = 1;
    let texts = new WeakMap<Element, { raster: HTMLCanvasElement | null; w: number }>();
    const icons = new WeakMap<Element, HTMLImageElement | "loading">();
    const content = findContent();
    const near = new Set<Element>();
    let observer: IntersectionObserver | null = null;

    const clearFields = () => {
        gl.clearColor(0, 0, 0, 1);
        for (const f of fields) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, f.frame);
            gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clear(gl.COLOR_BUFFER_BIT);
    };

    const size = () => {
        // The middle of the sidebar's 3px fade; the canvas spans the sidebar
        // and the fluid's reach out over the content.
        edge = Math.round(sidebar.getBoundingClientRect().right - 1.5);
        height = window.innerHeight;
        width = edge + REACH;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = width;
        canvas.height = height;
        strip.width = AHEAD;
        strip.height = height;
        simW = Math.max(1, Math.round(width * SIM_SCALE));
        simH = Math.max(1, Math.round(height * SIM_SCALE));
        for (const f of fields) {
            gl.bindTexture(gl.TEXTURE_2D, f.texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, format, simW, simH, 0, gl.RGBA, type, null);
        }
        clearFields();
        texts = new WeakMap();
        observer?.disconnect();
        near.clear();
        observer = new IntersectionObserver((entries) => {
            for (const e of entries) {
                if (e.isIntersecting) near.add(e.target);
                else near.delete(e.target);
            }
        }, { rootMargin: `0px ${-(window.innerWidth - edge - AHEAD)}px 0px ${-(edge - 1)}px` });
        content.forEach((el) => observer?.observe(el));
    };
    size();
    window.addEventListener("resize", size);

    /** Each crossing element's left edge last frame, to read its speed. */
    const lastLeft = new WeakMap<Element, number>();
    /** How fast the content is moving into the border, px per frame, eased. */
    let speed = 0;
    let fastest = 0;

    /** Draws what has passed into the border, as it lies just right of the
     *  edge; true if anything has. */
    const paintStrip = (): boolean => {
        stripCtx.clearRect(0, 0, AHEAD, height);
        let any = false;
        fastest = 0;
        for (const el of near) {
            const r = el.getBoundingClientRect();
            // Only what has passed into the border is eaten: content resting
            // against it (a card parked at the edge, a list starting there)
            // is left alone.
            if (r.width === 0 || r.right <= edge || r.left > edge - 1 || r.bottom < 0 || r.top > height) continue;
            const style = getComputedStyle(el);
            const opacity = Number(style.opacity);
            if (style.visibility === "hidden" || opacity === 0) continue;
            stripCtx.globalAlpha = Number.isFinite(opacity) ? Math.min(1, opacity) : 1;
            const before = lastLeft.get(el);
            lastLeft.set(el, r.left);
            if (before !== undefined) fastest = Math.max(fastest, before - r.left);
            const x = r.left - edge;
            if (el instanceof HTMLImageElement) {
                if (!el.complete || !el.naturalWidth) continue;
                const c = containedRect(el, r);
                stripCtx.drawImage(el, c.x - edge, c.y, c.w, c.h);
            } else if (el instanceof SVGSVGElement) {
                const icon = icons.get(el);
                if (!icon) {
                    icons.set(el, "loading");
                    rasterizeIcon(el, (img) => icons.set(el, img));
                }
                if (!icon || icon === "loading") continue;
                stripCtx.drawImage(icon, x, r.top, r.width, r.height);
            } else {
                let cached = texts.get(el);
                // Redrawn when its box changes width (letters easing open).
                if (!cached || Math.abs(cached.w - r.width) > 2) {
                    cached = { raster: rasterizeText(el), w: r.width };
                    texts.set(el, cached);
                }
                if (!cached.raster) continue;
                stripCtx.drawImage(cached.raster, x, r.top, r.width + 4, r.height + 4);
            }
            any = true;
        }
        stripCtx.globalAlpha = 1;
        return any;
    };

    let clock = 0;
    /** One full-screen pass of `program` into `target` (null: the canvas). */
    const pass = (program: WebGLProgram, target: Target | null, textures: Record<string, WebGLTexture>, values: Record<string, number> = {}) => {
        gl.useProgram(program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.frame : null);
        gl.viewport(0, 0, target ? simW : width, target ? simH : height);
        gl.uniform2f(gl.getUniformLocation(program, "texel"), 1 / simW, 1 / simH);
        gl.uniform2f(gl.getUniformLocation(program, "view"), width, height);
        gl.uniform1f(gl.getUniformLocation(program, "edge"), edge);
        gl.uniform1f(gl.getUniformLocation(program, "time"), clock);
        let unit = 0;
        for (const [name, texture] of Object.entries(textures)) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(gl.getUniformLocation(program, name), unit++);
        }
        for (const [name, value] of Object.entries(values)) gl.uniform1f(gl.getUniformLocation(program, name), value);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    let raf = 0;
    let lastContent = -Infinity;
    let idle = true;
    const tick = (ms: number) => {
        raf = requestAnimationFrame(tick);
        clock = ms / 1000;
        const touching = near.size > 0 && paintStrip();
        if (touching) lastContent = clock;
        speed += ((touching ? Math.min(fastest, 40) : 0) - speed) * 0.2;
        if (clock - lastContent > LINGER) {
            if (!idle) {
                clearFields();
                idle = true;
            }
            return;
        }
        idle = false;
        if (!touching) stripCtx.clearRect(0, 0, AHEAD, height);
        gl.bindTexture(gl.TEXTURE_2D, contentTexture);
        try {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, strip);
        } catch {
            // Content the browser will not hand to WebGL: nothing to eat.
            return;
        }

        // Fading out: the light thins away gradually, never cut off.
        const fade = Math.min(1, Math.max(0, (clock - lastContent - (LINGER - FADE)) / FADE));
        const keep = 1 - 0.07 * fade;
        for (const layer of [metal, flare]) {
            const { velocity, dye, pressure } = layer;
            // The curl lands in the divergence field, which is rewritten below.
            pass(p.curl, divergence, { velocity: velocity.read.texture });
            pass(p.force, velocity.write, { velocity: velocity.read.texture, dye: dye.read.texture, curl: divergence.texture },
                { speed: speed * SIM_SCALE, ...layer.force });
            velocity.swap();
            pass(p.viscosity, velocity.write, { velocity: velocity.read.texture }, { thick: layer.thick });
            velocity.swap();
            pass(p.divergence, divergence, { velocity: velocity.read.texture });
            for (let i = 0; i < layer.pressureSteps; i++) {
                pass(p.pressure, pressure.write, { pressure: pressure.read.texture, divergence: divergence.texture });
                pressure.swap();
            }
            pass(p.gradient, velocity.write, { pressure: pressure.read.texture, velocity: velocity.read.texture });
            velocity.swap();
            pass(p.advect, velocity.write, { velocity: velocity.read.texture, source: velocity.read.texture }, { near: 0.99, far: 0.95 });
            velocity.swap();
            pass(p.inject, dye.write, { dye: dye.read.texture, content: contentTexture }, { ahead: AHEAD, amount: layer.amount });
            dye.swap();
            pass(p.advect, dye.write, { velocity: velocity.read.texture, source: dye.read.texture },
                { near: layer.keep[0] * keep, far: layer.keep[1] * keep });
            dye.swap();
        }
        pass(p.display, null, { dye: metal.dye.read.texture, flare: flare.dye.read.texture });
    };
    raf = requestAnimationFrame(tick);

    return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", size);
        observer?.disconnect();
        canvas.remove();
        gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
}
