/**
 * A scroll-driven optical interlude. The spectrum is not a rainbow texture:
 * every wavelength gets its own Cauchy IOR and is refracted through the two
 * prism faces. The surrounding noise is the participating medium that hides
 * and reveals the result.
 */
const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }
`;

const fragment = `#version 300 es
precision highp float;

uniform vec2 resolution;
uniform float progress;
uniform float time;
uniform float isMobile;
out vec4 outColor;

#define PI 3.14159265359

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3. - 2. * f);
    return mix(mix(hash21(i), hash21(i + vec2(1., 0.)), f.x),
               mix(hash21(i + vec2(0., 1.)), hash21(i + 1.), f.x), f.y);
}

float fbm(vec2 p) {
    float sum = 0., amp = .52;
    mat2 turn = mat2(.82, -.57, .57, .82);
    for (int i = 0; i < 5; i++) {
        sum += valueNoise(p) * amp;
        p = turn * p * 2.03 + 8.17;
        amp *= .5;
    }
    return sum;
}

mat2 rotate2d(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

float segmentDistance(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
    return length(pa - ba * h);
}

float cross2(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }

bool inTriangle(vec2 p, vec2 a, vec2 b, vec2 c) {
    float d1 = cross2(b - a, p - a);
    float d2 = cross2(c - b, p - b);
    float d3 = cross2(a - c, p - c);
    return (d1 >= 0. && d2 >= 0. && d3 >= 0.) ||
           (d1 <= 0. && d2 <= 0. && d3 <= 0.);
}

float rayDistance(vec2 p, vec2 origin, vec2 direction, float rayLength) {
    float along = dot(p - origin, direction);
    vec2 nearest = origin + direction * clamp(along, 0., rayLength);
    return length(p - nearest);
}

// Approximate visible-spectrum conversion. It is deliberately continuous:
// adjacent wavelength samples overlap into light rather than seven stripes.
vec3 wavelength(float nm) {
    vec3 c = vec3(0.);
    if (nm < 440.) c = vec3(-(nm - 440.) / 60., 0., 1.);
    else if (nm < 490.) c = vec3(0., (nm - 440.) / 50., 1.);
    else if (nm < 510.) c = vec3(0., 1., -(nm - 510.) / 20.);
    else if (nm < 580.) c = vec3((nm - 510.) / 70., 1., 0.);
    else if (nm < 645.) c = vec3(1., -(nm - 645.) / 65., 0.);
    else c = vec3(1., 0., 0.);
    float edge = nm < 420. ? .35 + .65 * (nm - 400.) / 20.
               : nm > 680. ? .35 + .65 * (700. - nm) / 20. : 1.;
    return max(c * edge, 0.);
}

void main() {
    vec2 p = (gl_FragCoord.xy - .5 * resolution) / resolution.y;
    float aspect = resolution.x / resolution.y;
    float eased = progress * progress * (3. - 2. * progress);
    float angle = mix(-.075, .085, eased);
    float breathe = sin(time * .42) * .0025;
    mat2 rotation = rotate2d(angle + breathe);

    // The prism sits off-centre on desktop so the spectrum has somewhere to
    // travel. The phone composition lifts it and uses the screen diagonally.
    vec2 centre = mix(vec2(-.10, .015), vec2(-.055, .075), isMobile);
    float prismScale = mix(1., .82, isMobile);
    vec2 top = centre + rotation * vec2(0., .235) * prismScale;
    vec2 left = centre + rotation * vec2(-.225, -.205) * prismScale;
    vec2 right = centre + rotation * vec2(.225, -.205) * prismScale;

    float edge = min(segmentDistance(p, left, top),
                 min(segmentDistance(p, top, right), segmentDistance(p, right, left)));
    bool glass = inTriangle(p, left, top, right);

    vec2 incident = normalize(rotation * vec2(1., mix(-.02, .035, eased)));
    vec2 enterPoint = mix(left, top, .48);
    vec2 exitPoint = mix(top, right, .56);
    vec2 enterNormal = rotation * normalize(vec2(-.44, .225));
    vec2 exitNormal = rotation * normalize(vec2(.44, .225));

    // Cloud coordinates have a tiny row-wise wobble: the imperfection belongs
    // to the photographed medium, rather than being a glitch pasted on top.
    float row = floor((p.y + .5) * resolution.y * .16);
    float tape = (hash21(vec2(row, floor(time * 7.))) - .5) * .005;
    vec2 cloudP = p + vec2(tape, 0.);
    float cloudA = fbm(cloudP * 2.2 + vec2(time * .011, -time * .007));
    float cloudB = fbm(cloudP * 4.1 - vec2(time * .008, time * .006) + 11.);
    float cloudShape = exp(-pow(length((p - centre - vec2(.02, .015)) * vec2(.82, 1.3)) / .62, 4.));
    float cloud = smoothstep(.48, .76, cloudA * .76 + cloudB * .32) * cloudShape;

    vec3 colour = vec3(0.);
    float alpha = 0.;

    // Collimated white source. It blooms as it reaches the cloud and prism.
    float before = dot(enterPoint - p, incident);
    float whiteDistance = abs(cross2(p - enterPoint, incident));
    float whiteGate = smoothstep(.0, .035, before) * smoothstep(aspect + .3, .05, before);
    float whiteBeam = exp(-whiteDistance * whiteDistance / .00020) * whiteGate;
    whiteBeam *= .34 + cloud * .9;
    colour += vec3(.83, .89, 1.) * whiteBeam * .9;
    alpha = max(alpha, whiteBeam * .68);

    vec3 spectrum = vec3(0.);
    float spectrumEnergy = 0.;
    const int SAMPLES = 18;
    for (int i = 0; i < SAMPLES; i++) {
        float fi = float(i) / float(SAMPLES - 1);
        float nm = mix(410., 690., fi);
        float lambda = nm * .001;
        // Cauchy's equation, using a plausible high-dispersion optical glass.
        float ior = 1.50 + .008 / (lambda * lambda);
        vec2 insideRay = refract(incident, enterNormal, 1. / ior);
        vec2 outgoing = refract(insideRay, -exitNormal, ior);
        if (dot(outgoing, outgoing) < .1) continue;
        outgoing = normalize(outgoing);

        float d = rayDistance(p, exitPoint, outgoing, mix(.92, .72, isMobile));
        float width = mix(.0048, .0062, isMobile);
        float ray = exp(-d * d / (width * width));
        float along = dot(p - exitPoint, outgoing);
        ray *= smoothstep(-.005, .055, along) * (1. - smoothstep(.58, .93, along));
        vec3 spectralColour = wavelength(nm);
        spectrum += spectralColour * ray;
        spectrumEnergy += ray;
    }
    spectrum /= 5.2;
    spectrumEnergy /= 5.2;

    // Early in the passage the cloud hides the separated rays. Scroll changes
    // both incidence and the amount of the optical path that escapes the haze.
    float reveal = smoothstep(.16, .53, eased);
    float cloudTransmission = mix(.18, .72, 1. - cloud);
    spectrum *= reveal * cloudTransmission;
    spectrumEnergy *= reveal * cloudTransmission;
    colour += spectrum * 1.48;
    alpha = max(alpha, spectrumEnergy * .68);

    // A refractive solid: dim interior, hard Fresnel edge, internal spectral
    // sheen and bright caustics at the entry/exit points.
    if (glass) {
        float rim = exp(-edge * 95.);
        float internal = fbm((rotation * (p - centre)) * 13. + time * .015);
        vec3 glassBody = vec3(.055, .07, .095) * (.55 + internal * .45);
        vec3 edgeTint = mix(vec3(.36, .58, .78), vec3(.82, .45, .72),
                            clamp((p.y - centre.y) * 2. + .5, 0., 1.));
        colour += glassBody + edgeTint * rim * .55;
        alpha = max(alpha, .22 + rim * .46);
    } else {
        float rim = exp(-edge * 135.);
        colour += vec3(.34, .48, .64) * rim * .13;
        alpha = max(alpha, rim * .1);
    }

    float entryGleam = exp(-dot(p - enterPoint, p - enterPoint) / .00062);
    float exitGleam = exp(-dot(p - exitPoint, p - exitPoint) / .00115);
    colour += vec3(.88, .95, 1.) * entryGleam * .42;
    colour += vec3(1., .91, .78) * exitGleam * (.28 + reveal * .45);
    alpha = max(alpha, max(entryGleam, exitGleam) * .68);

    // Cloud is lit from within, strongest where the incoming beam disappears.
    float cloudLight = cloud * (.055 + whiteBeam * .26 + exitGleam * .13);
    colour += vec3(.45, .50, .59) * cloudLight;
    alpha = max(alpha, cloud * .16);

    // Filmic rolloff, then a restrained low-bit highlight texture. Dark areas
    // stay smooth; only the optical event acquires the slightly degraded feel.
    colour = colour / (1. + colour);
    float luma = dot(colour, vec3(.2126, .7152, .0722));
    vec3 quantised = floor(colour * 56. + hash21(gl_FragCoord.xy + floor(time * 8.))) / 56.;
    colour = mix(colour, quantised, smoothstep(.12, .65, luma) * .22);
    colour += (hash21(gl_FragCoord.xy + time * 19.) - .5) * .018 * smoothstep(.04, .5, luma);

    float sceneFade = smoothstep(.015, .13, progress) * (1. - smoothstep(.86, .985, progress));
    alpha = clamp(alpha * sceneFade, 0., .92);
    colour *= sceneFade;
    outColor = vec4(max(colour, 0.), alpha);
}
`;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function mountPrismGleam(section: HTMLElement, canvas: HTMLCanvasElement): () => void {
    const gl = canvas.getContext("webgl2", {
        alpha: true,
        premultipliedAlpha: false,
        antialias: false,
        depth: false,
        powerPreference: "low-power",
    });
    if (!gl) return () => {};

    const shaders: WebGLShader[] = [];
    const program = gl.createProgram();
    if (!program) return () => {};
    for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(kind);
        if (!shader) continue;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn("Prism shader unavailable:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            shaders.forEach((item) => gl.deleteShader(item));
            gl.deleteProgram(program);
            return () => {};
        }
        shaders.push(shader);
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        shaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(program);
        return () => {};
    }

    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const resolution = gl.getUniformLocation(program, "resolution");
    const progress = gl.getUniformLocation(program, "progress");
    const time = gl.getUniformLocation(program, "time");
    const isMobile = gl.getUniformLocation(program, "isMobile");
    const mobile = window.matchMedia("(max-width: 1023px)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    let width = 0;
    let height = 0;
    let visible = false;
    let disposed = false;
    let frame = 0;
    let current = .5;
    let target = .5;
    let last = 0;

    const resize = () => {
        const nextWidth = canvas.clientWidth;
        const nextHeight = canvas.clientHeight;
        if (nextWidth === width && nextHeight === height) return;
        width = nextWidth;
        height = nextHeight;
        const cap = mobile.matches ? .62 : .82;
        const ratio = Math.min(devicePixelRatio, cap, 1440 / Math.max(width, 1), 960 / Math.max(height, 1));
        canvas.width = Math.max(1, Math.round(width * ratio));
        canvas.height = Math.max(1, Math.round(height * ratio));
        gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const measure = () => {
        const rect = section.getBoundingClientRect();
        const travel = Math.max(1, rect.height - window.innerHeight);
        target = clamp01(-rect.top / travel);
        if (reduced.matches) current = .58;
    };

    const draw = (now: number) => {
        if (disposed) return;
        frame = requestAnimationFrame(draw);
        if (!visible || document.hidden) return;
        const interval = 1000 / (mobile.matches ? 24 : 30);
        if (last && now - last < interval) return;
        const elapsed = Math.min(.08, (now - (last || now)) / 1000);
        last = now;

        resize();
        measure();
        const smoothing = reduced.matches ? 1 : 1 - Math.exp(-elapsed * 9.5);
        current += (target - current) * smoothing;

        gl.uniform2f(resolution, canvas.width, canvas.height);
        gl.uniform1f(progress, current);
        gl.uniform1f(time, reduced.matches ? 0 : now / 1000);
        gl.uniform1f(isMobile, mobile.matches ? 1 : 0);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const observer = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
            last = 0;
            measure();
        }
    }, { rootMargin: "25% 0px" });
    observer.observe(section);
    resize();
    measure();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);

    return () => {
        disposed = true;
        cancelAnimationFrame(frame);
        observer.disconnect();
        window.removeEventListener("resize", resize);
        gl.deleteBuffer(buffer);
        shaders.forEach((shader) => gl.deleteShader(shader));
        gl.deleteProgram(program);
    };
}
