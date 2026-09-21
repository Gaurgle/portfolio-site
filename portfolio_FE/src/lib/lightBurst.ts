/** Volumetric light streaming out of the ROOS glyphs, drawn into the clouds'
 * own WebGL context after the sky. The classic screen-space scattering march:
 * each pixel walks toward the light and collects every glyph it crosses, so
 * the letters throw rays away from the source. Red, green and blue walk
 * slightly different distances, which disperses the ray tips into a spectrum
 * the same way the prism's beam is dispersed further down the page.
 */

const burstFragment = `#version 300 es
precision highp float;
uniform sampler2D glyphs;
uniform vec4 rect;
uniform vec2 light;
uniform float power;
uniform int samples;
out vec4 color;
// rect is the mask's centre and half size in canvas pixels. The mask keeps an
// empty border around the letters, so anything past its edge reads as none.
float glyph(vec2 at) {
    vec2 uv=(at-rect.xy)/rect.zw*.5+.5;
    if(uv.x<0. || uv.y<0. || uv.x>1. || uv.y>1.) return 0.;
    return texture(glyphs,vec2(uv.x,1.-uv.y)).r;
}
void main() {
    vec2 at=gl_FragCoord.xy;
    vec2 toLight=light-at;
    // A fixed per-pixel offset turns the march's slices into fine grain.
    float jitter=fract(sin(dot(at,vec2(12.9898,78.233)))*43758.5453);
    // How far toward the light each channel walks: blue reaches furthest, so
    // rays run white near the letters and cool to violet at their tips.
    vec3 reach=vec3(.68,.74,.82);
    vec3 sum=vec3(0.);
    float weight=1., total=0.;
    for(int i=0;i<32;i++) {
        if(i>=samples) break;
        float t=(float(i)+jitter)/float(samples);
        sum+=weight*vec3(glyph(at+toLight*t*reach.r),
            glyph(at+toLight*t*reach.g),glyph(at+toLight*t*reach.b));
        total+=weight;
        weight*=.95;
    }
    // Rays thin out with distance from the light in a round bloom, so the
    // burst never takes on the word's rectangular outline.
    vec2 away=(at-light)/(rect.z*vec2(3.,2.1));
    float falloff=exp(-dot(away,away)*2.4);
    vec3 energy=sum/total*power*falloff*vec3(1.,.97,.95);
    vec3 lit=1.-exp(-energy*1.7);
    lit=max(lit+(jitter-.5)/255.,0.);
    color=vec4(lit,max(lit.r,max(lit.g,lit.b)));
}
`;

export type LightBurst = {
    /** Draw over the finished sky. `pointer` is 0..1 across the viewport, y
     *  up, or null when there is no pointer to lean toward: the light then
     *  eases back to rest, dead centre behind the letters. `step` is the
     *  frame time in seconds. */
    draw(pointer: { x: number; y: number } | null, power: number, fine: boolean, step: number): void;
    dispose(): void;
};

/** Character cells of empty margin around the letters in the mask: room for
 * their bloom to fade out before the texture's edge. */
const BORDER = 3;
const CELL = 12;

/** Rasterise block art into a coverage mask: one texel block per character
 * cell, so it matches the DOM glyphs whatever font the browser picked. The
 * cells bloom into each other and sit on a soft elliptical glow, so the
 * rays read as light from a word rather than from a grid of boxes. */
function glyphMask(art: string): HTMLCanvasElement | null {
    const rows = art.split("\n").filter(row => row.trim().length > 0);
    const columns = Math.max(0, ...rows.map(row => [...row].length));
    if (rows.length === 0 || columns === 0) return null;
    const mask = document.createElement("canvas");
    mask.width = (columns + BORDER * 2) * CELL;
    mask.height = (rows.length + BORDER * 2) * CELL;
    const context = mask.getContext("2d");
    if (!context) return null;
    // The whole word glows faintly, so the gaps between letters cast soft
    // shafts instead of hard black seams through the rays.
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, "rgb(78 78 78)");
    glow.addColorStop(.55, "rgb(48 48 48)");
    glow.addColorStop(1, "rgb(0 0 0)");
    context.save();
    context.translate(mask.width / 2, mask.height / 2);
    context.scale(mask.width / 2, mask.height / 2);
    context.fillStyle = glow;
    context.fillRect(-1, -1, 2, 2);
    context.restore();
    // shadowBlur rather than a canvas filter: Safari has no context.filter.
    context.globalCompositeOperation = "lighter";
    context.fillStyle = "rgb(200 200 200)";
    context.shadowColor = "#fff";
    context.shadowBlur = CELL * 0.9;
    rows.forEach((row, y) => [...row].forEach((character, x) => {
        if (character.trim()) context.fillRect((x + BORDER) * CELL, (y + BORDER) * CELL, CELL, CELL);
    }));
    return mask;
}

/**
 * `link` compiles a fragment shader against the caller's full-screen quad.
 * `source` is the element holding the block art; its live bounding box places
 * the rays, so they follow its layout, its entrance and its scroll explosion.
 * Returns null when the mask or shader is unavailable: the sky stands alone.
 */
export function createLightBurst(
    gl: WebGL2RenderingContext,
    link: (fragment: string) => WebGLProgram | null,
    source: HTMLElement,
): LightBurst | null {
    const mask = glyphMask(source.textContent ?? "");
    const program = mask && link(burstFragment);
    if (!mask || !program) return null;
    const columns = mask.width / CELL, rows = mask.height / CELL;
    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const locations = {
        rect: uniform("rect"), light: uniform("light"),
        power: uniform("power"), samples: uniform("samples"),
    };
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(program);
    gl.uniform1i(uniform("glyphs"), 2);
    // The light's eased offset from rest, in canvas pixels.
    const lean = { x: 0, y: 0 };

    return {
        draw(pointer, power, fine, step) {
            if (power <= 0.004) return;
            const box = source.getBoundingClientRect();
            const canvas = gl.canvas as HTMLCanvasElement;
            const ratio = canvas.width / canvas.clientWidth;
            if (box.width === 0 || box.bottom < 0 || box.top > canvas.clientHeight) return;
            // Grow the glyph box by the mask's border.
            const halfW = box.width / 2 * (columns / (columns - BORDER * 2)) * ratio;
            const halfH = box.height / 2 * (rows / (rows - BORDER * 2)) * ratio;
            const centreX = (box.left + box.width / 2) * ratio;
            const centreY = canvas.height - (box.top + box.height / 2) * ratio;
            // The light rests dead centre behind the letters, so the burst is
            // symmetrical, and leans toward the pointer while there is one.
            const follow = 1 - Math.exp(-step * 4);
            lean.x += ((pointer ? (pointer.x * canvas.width - centreX) * .3 : 0) - lean.x) * follow;
            lean.y += ((pointer ? (pointer.y * canvas.height - centreY) * .3 : 0) - lean.y) * follow;
            const lightX = centreX + lean.x, lightY = centreY + lean.y;
            // The bloom has faded to nothing well inside this box.
            const spanX = halfW * 3 * 1.7, spanY = halfW * 2.1 * 1.7;
            const left = Math.max(0, Math.floor(lightX - spanX));
            const bottom = Math.max(0, Math.floor(lightY - spanY));
            const right = Math.min(canvas.width, Math.ceil(lightX + spanX));
            const top = Math.min(canvas.height, Math.ceil(lightY + spanY));
            if (right <= left || top <= bottom) return;
            gl.useProgram(program);
            gl.enable(gl.BLEND);
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(left, bottom, right - left, top - bottom);
            gl.uniform4f(locations.rect, centreX, centreY, halfW, halfH);
            gl.uniform2f(locations.light, lightX, lightY);
            gl.uniform1f(locations.power, power);
            gl.uniform1i(locations.samples, fine ? 32 : 16);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            gl.disable(gl.SCISSOR_TEST);
        },
        dispose() {
            gl.deleteTexture(texture);
        },
    };
}
