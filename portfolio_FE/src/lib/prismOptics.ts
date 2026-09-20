/** Hidden extruded prism, traced in its cross-section. All lengths are in
 * cloud-local units. The light stays fixed as the glass turns, so incidence
 * actually changes. Seven wavelength paths are uploaded once per cloud frame.
 * This is geometric optics, not a wave-optics or full caustic simulation. */
type V = [number, number];

/** One unbounded clock for the whole flight, in cloud-local units. The head
 * advances 1.47 units over the original .66 scroll-progress interval. Once
 * formed, the complete spectral footprint translates at that same speed. */
export function gleamFlight(progress: number) {
    const distance = Math.max(0, progress - .04) * (1.47 / .66);
    const head = -.12 + distance;
    return {
        head: Math.min(head, 1.35),
        offset: Math.max(0, head - 1.35),
        growth: Math.min(1, distance / 1.47),
    };
}
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s];
const sub = (a: V, b: V): V => add(a, mul(b, -1));
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
const cross = (a: V, b: V) => a[0] * b[1] - a[1] * b[0];
const unit = (a: V): V => mul(a, 1 / Math.hypot(...a));
const turn = (a: V, angle: number): V => [
    a[0] * Math.cos(angle) - a[1] * Math.sin(angle),
    a[0] * Math.sin(angle) + a[1] * Math.cos(angle),
];

export function refractRay(d: V, normal: V, eta: number): V | null {
    const c = dot(normal, d);
    const k = 1 - eta * eta * (1 - c * c);
    return k < 0 ? null : sub(mul(d, eta), mul(normal, eta * c + Math.sqrt(k)));
}

export function tracePrism(progress: number, wavelength: number) {
    // Stay below total internal reflection throughout the visible spectrum.
    const angle = -.23 + Math.max(0, Math.min(1, progress)) * .14;
    // Counter-clockwise winding; normals face out of the glass.
    const vertices: V[] = [[-.07, -.045], [.07, -.045], [0, .076]]
        .map(v => turn(v as V, angle));
    const hit = (origin: V, direction: V) => {
        let nearest: { point: V; normal: V; distance: number } | null = null;
        for (let i = 0; i < 3; i++) {
            const a = vertices[i], b = vertices[(i + 1) % 3];
            const edge = sub(b, a), denom = cross(direction, edge);
            if (Math.abs(denom) < 1e-8) continue;
            const t = cross(sub(a, origin), edge) / denom;
            const u = cross(sub(a, origin), direction) / denom;
            if (t > 1e-6 && u >= 0 && u <= 1 && (!nearest || t < nearest.distance)) {
                nearest = { point: add(origin, mul(direction, t)),
                    normal: unit([edge[1], -edge[0]]), distance: t };
            }
        }
        return nearest;
    };
    const incoming: V = [1, 0];
    const entry = hit([-.5, 0], incoming);
    if (!entry) return null;
    // Cauchy approximation for dispersive glass; wavelength in micrometres.
    const n = 1.50 + .008 / (wavelength * wavelength);
    const internal = refractRay(incoming, entry.normal, 1 / n);
    if (!internal) return null;
    const exit = hit(add(entry.point, mul(internal, 1e-5)), internal);
    if (!exit) return null;
    const outgoing = refractRay(internal, mul(exit.normal, -1), n);
    if (!outgoing) return null;
    // Orient the complete optical system once, not each wavelength separately.
    const position = add(turn(exit.point, .96), [-.57, .04]);
    const direction = turn(outgoing, .96);
    return { position, direction, entry: entry.point, exit: exit.point, internal, n };
}

export function spectralPaths(progress: number): Float32Array {
    const result = new Float32Array(7 * 4);
    for (let i = 0; i < 7; i++) {
        const ray = tracePrism(progress, .43 + i * .04);
        if (ray) result.set([...ray.position, ...ray.direction], i * 4);
    }
    return result;
}
