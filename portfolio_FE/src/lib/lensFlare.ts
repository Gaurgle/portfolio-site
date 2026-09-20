/** Camera lens flare off the MORE PROJECTS arrow while it holds the stage. The
 * glint itself stays pinned to one corner of the arrow, like a highlight on a
 * polished edge; an unseen light passes overhead with the scroll, and
 * everything its angle governs swings around that point. A flare is made
 * inside the lens, so it draws at full resolution in front of the page, unlike
 * the soft, low-resolution sky behind it. Desktop only, and only while the
 * pass is active. */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const s = clamp01(v); return s * s * (3 - 2 * s); };

/** The arrow's time on stage to the unseen light's pass. `life` is the scroll
 * engine's --arrow-life: 0 as the arrow's fill floods in, 1 once it has left.
 * `travel` follows it left to right; `strength` eases in from nothing, holds
 * while the arrow stands complete and is fully out again by the time it has
 * gone, so nothing pops or lingers. */
export function flarePass(life: number) {
    const travel = clamp01(life);
    return { travel, strength: smooth(travel / .3) * (1 - smooth((travel - .7) / .3)) };
}

const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }
`;
// Units are half viewport heights from the frame centre, y up. Each channel
// is traced with its own dispersion, as glass would, so ghost and halo edges
// carry real colour fringes; the page's slight chromatic split and banded
// warp ride on top.
const fragment = `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform vec2 source;
uniform vec2 axis;
uniform vec2 split;
uniform float strength;
uniform float warp;
uniform float time;
out vec4 color;
// Distance to the edge of a regular polygon: the aperture's blade outline.
float aperture(vec2 p, float radius, float blades) {
    if(blades<1.) return length(p)-radius;
    float slice=6.2831853/blades, angle=atan(p.y,p.x);
    return cos(floor(.5+angle/slice)*slice-angle)*length(p)-radius;
}
// One internal reflection: an image of the aperture k along the axis the
// light throws through the glint (negative k: back toward the light),
// crisp at its rim.
float ghost(vec2 p, float k, float radius, float blades, float rim, float spread) {
    float edge=aperture(p-source-axis*k*spread, radius*spread, blades);
    float body=1.-smoothstep(-.014,0.,edge);
    return body*(.45+.55*smoothstep(-radius,0.,edge))+rim*.6*exp(-pow(edge/.008,2.));
}
// The flare's parts, each with its own level. Which of them show is a matter
// of taste, so they all stay built: for now only the aperture ghosts (and the
// halo arc) play, and the glint itself is dark. Raise a level to bring its
// part back; 1 is the strength it was tuned at.
const float CORE=0., STAR=0., STREAK=0., HALO=1., GHOSTS=1.;
float flare(vec2 p, int channel) {
    // Longer wavelengths image slightly larger: red outermost.
    float spread=1.+.022*float(1-channel);
    vec3 pick=vec3(channel==0,channel==1,channel==2);
    vec2 d=p-source;
    float r=length(d), angle=atan(d.y,d.x)+atan(axis.y,axis.x);
    // Hot core easing into its bloom and a faint veil, with no hard disc to
    // read as pasted on.
    float light=CORE*(.8*exp(-r*r/.0009)+.22*exp(-r*8.)+.05*exp(-r*3.5)/(r*12.+.4)
        +.025*exp(-r*r/.45));
    // Diffraction off the blades: a star that turns with the light's angle.
    light+=STAR*(pow(abs(cos(angle*7.)),150.)*exp(-r*(9.+3.5*cos(angle*3.+1.)))*.16
        +pow(abs(cos(angle*23.+1.7)),70.)*exp(-r*17.)*.08);
    // Anamorphic streak, cooler than the source.
    float streak=exp(-d.y*d.y/.00005)*.45+exp(-d.y*d.y/.0005)*.1;
    light+=STREAK*streak/(1.+pow(abs(d.x)/.6,2.))*dot(pick,vec3(.5,.74,1.));
    // Halo: only the arc on the far side from the light, its radius dispersed.
    float facing=.5+.5*dot(d/max(r,.0001),normalize(axis));
    light+=HALO*exp(-pow((r-.43*spread)/.02,2.))*facing*facing*.11;
    float ghosts=ghost(p,.3,.04,6.,.5,spread)*dot(pick,vec3(.35,1.,.62))*.25
        +ghost(p,.55,.09,6.,.9,spread)*dot(pick,vec3(1.,.6,.24))*.13
        +ghost(p,.92,.058,6.,.6,spread)*dot(pick,vec3(.45,.58,1.))*.22
        +ghost(p,1.4,.17,0.,1.4,spread)*dot(pick,vec3(.7,.4,1.))*.065
        +ghost(p,1.85,.11,6.,.7,spread)*dot(pick,vec3(.3,.9,1.))*.14
        +ghost(p,-.34,.021,0.,.3,spread)*dot(pick,vec3(1.,1.,.8))*.22
        +ghost(p,-.62,.011,0.,.2,spread)*dot(pick,vec3(1.,.8,.55))*.28;
    return light+GHOSTS*ghosts;
}
void main() {
    vec2 uv=gl_FragCoord.xy/resolution;
    vec2 p=(uv*2.-1.)*vec2(resolution.x/resolution.y,1.);
    p.x+=(sin(uv.y*24.+time*.5)*.72+sin(uv.y*71.-time*.3)*.28)*warp;
    vec3 light=vec3(flare(p+split,0),flare(p,1),flare(p-split,2))*strength;
    light=min(light,1.);
    // Premultiplied: over the page this adds light without dimming it much.
    color=vec4(light,max(light.r,max(light.g,light.b)));
}
`;

/** Mount the flare on a full-screen canvas. Missing WebGL leaves the page as is. */
export function mountLensFlare(canvas: HTMLCanvasElement): () => void {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const arrow = document.querySelector<HTMLElement>("#projects [data-hscroll-arrow]");
    const shape = arrow?.querySelector<SVGElement>("svg");
    if (!arrow || !shape) return () => {};

    type Stage = { gl: WebGL2RenderingContext; program: WebGLProgram; buffer: WebGLBuffer | null;
        uniforms: Record<string, WebGLUniformLocation | null> };
    let stage: Stage | null = null, unavailable = false;
    // Phones never draw the flare, so the context is only built on first use.
    const prepare = (): Stage | null => {
        if (stage || unavailable) return stage;
        const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: "low-power" });
        const program = gl?.createProgram();
        if (!gl || !program) { unavailable = true; return null; }
        gl.bindAttribLocation(program, 0, "position");
        for (const [type, text] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
            const shader = gl.createShader(type)!;
            gl.shaderSource(shader, text);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.warn("Lens flare shader unavailable:", gl.getShaderInfoLog(shader));
                unavailable = true;
                return null;
            }
            gl.attachShader(program, shader);
            // Flagged now, freed with the program.
            gl.deleteShader(shader);
        }
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { unavailable = true; return null; }
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        gl.clearColor(0, 0, 0, 0);
        const uniforms = Object.fromEntries(["resolution","source","axis","split","strength","warp","time"]
            .map(n => [n, gl.getUniformLocation(program, n)]));
        return stage = { gl, program, buffer, uniforms };
    };

    let frame = 0, last = 0, clock = 0, previousScroll = window.scrollY, pace = 0, drawn = false, disposed = false;
    const render = (now: number) => {
        if (disposed) return;
        frame = requestAnimationFrame(render);
        if (document.hidden) return;
        const height = window.innerHeight, width = window.innerWidth;
        const step = last ? Math.min((now - last) / 1000, .1) : 0;
        last = now;
        const sweep = flarePass(parseFloat(arrow.style.getPropertyValue("--arrow-life")) || 0);
        const box = shape.getBoundingClientRect();
        const active = desktop.matches && !reduced.matches && sweep.strength > .001 && box.width > 0;
        const ready = active || drawn ? prepare() : null;
        if (!ready) return;
        const { gl, uniforms } = ready;
        if (!active) {
            // One clear when the sweep ends; idle frames then cost nothing.
            gl.clear(gl.COLOR_BUFFER_BIT);
            drawn = false;
            return;
        }
        // Sharp, but bounded: a flare needs device pixels, not unlimited ones.
        const ratio = Math.min(devicePixelRatio, 2, Math.sqrt(3_200_000 / (width * height)));
        const w = Math.round(width * ratio), h = Math.round(height * ratio);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        // Scroll speed feeds the chromatic split, quick to rise and slow to settle.
        const speed = Math.abs(window.scrollY - previousScroll) / height / Math.max(step, 1 / 60);
        previousScroll = window.scrollY;
        const target = clamp01(speed / 1.5);
        pace += (target - pace) * (1 - Math.exp(-step * (target > pace ? 6 : 1.8)));
        clock += step;
        // The glint catches the outer corner of the arrow's elbow (78,10 in
        // its 100-unit viewBox), where a highlight would form, and rides the
        // arrow as it leaves. The light passes above it, left to right, so
        // the axis it throws through the glint swings from down-right to
        // down-left, sending the ghosts across the arrow's body.
        const x = box.left + box.width * .78, y = box.top + box.height * .1;
        const lightX = (sweep.travel - .5) * 2.6, lightY = .75;
        gl.uniform2f(uniforms.resolution, w, h);
        gl.uniform2f(uniforms.source, (x - width / 2) / (height / 2), (height / 2 - y) / (height / 2));
        gl.uniform2f(uniforms.axis, -lightX * .8, -lightY * .8);
        gl.uniform2f(uniforms.split, .0018 + pace * .0045, 0);
        gl.uniform1f(uniforms.warp, .0009 + pace * .002);
        gl.uniform1f(uniforms.strength, sweep.strength * .85);
        gl.uniform1f(uniforms.time, clock);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        drawn = true;
    };
    let contextLost = false;
    const lost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame);
    };
    canvas.addEventListener("webglcontextlost", lost);
    frame = requestAnimationFrame(render);
    return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        canvas.removeEventListener("webglcontextlost", lost);
        // Lost-context resources are already invalid, including after restoration.
        if (stage && !contextLost) {
            stage.gl.deleteBuffer(stage.buffer);
            stage.gl.deleteProgram(stage.program);
        }
    };
}
