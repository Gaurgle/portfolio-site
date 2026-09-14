/** Ray-marched cloud volumes with light absorption and a secondary shadow march.
 * A small, repeating 3D noise texture supplies detail without remote assets.
 * Scroll drives approach; slow independent drift, rotation and density changes
 * keep desktop clouds alive at rest. World-space positions preserve perspective.
 */
const vertex = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0., 1.); }
`;
const fragment = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D noiseVolume;
uniform vec2 resolution;
uniform vec3 center;
uniform vec3 scale;
uniform mat3 rotation;
uniform float time;
uniform float seed;
uniform float strength;
uniform float formation;
uniform int steps;
out vec4 color;
float noise(vec3 p) { return texture(noiseVolume, p).r; }
float field(vec3 p) {
    vec3 wind = vec3(time * .003, time * .001, 0.) + seed;
    vec3 q = p * .14 + wind;
    float n = noise(q) * .48 + noise(q*2.03) * .26
            + noise(q*4.11) * .14 + noise(q*8.21) * .08 + noise(q*16.3) * .04;
    vec3 warp = vec3(noise(q+.17), noise(q+.39), noise(q+.71)) - .5;
    vec3 v = p + warp * .38
        + .08*sin(p.yzx*2.2+vec3(time*.04,time*.03,-time*.025));
    float shape = max(1. - length((v-vec3(-.38,-.12,0.))*vec3(1.05,1.5,1.5)),
                  max(.85-length((v-vec3(.3,.18,.08))*vec3(1.15,1.4,1.35)),
                      .62-length((v-vec3(.75,-.14,-.1))*vec3(1.3,1.7,1.6))));
    // Condensation grows from dense cores into lobes and wisps. The volume's
    // opacity stays physical; birth and dispersal change its shape instead.
    float density = shape + (n-.52)*1.3 - (1.-formation)*1.6;
    return smoothstep(0.,.12,density) * max(0.,density) * 9.;
}
vec2 intersectBox(vec3 ro, vec3 rd) {
    vec3 a = (-vec3(1.5,1.15,1.15)-ro)/rd;
    vec3 b = ( vec3(1.5,1.15,1.15)-ro)/rd;
    vec3 lo = min(a,b), hi = max(a,b);
    return vec2(max(max(lo.x,lo.y),lo.z), min(min(hi.x,hi.y),hi.z));
}
void main() {
    vec2 uv = (gl_FragCoord.xy / resolution)*2.-1.;
    uv.x *= resolution.x / resolution.y;
    vec3 direction = normalize(vec3(uv,-1.8));
    vec3 ro = (transpose(rotation)*(vec3(0.,0.,6.)-center))/scale;
    vec3 rd = (transpose(rotation)*direction)/scale;
    vec2 hit = intersectBox(ro,rd);
    float start = max(0.,hit.x);
    if(hit.y <= start) { color=vec4(0.); return; }
    float dt = (hit.y-start)/float(steps);
    // A fixed per-pixel offset breaks slice banding without animated grain.
    float jitter = fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
    float t = start + dt*jitter;
    float transmittance=1.;
    vec3 radiance=vec3(0.);
    vec3 light=normalize(transpose(rotation)*vec3(-.6,.9,.25));
    for(int i=0;i<88;i++) {
        if(i>=steps || transmittance<.015) break;
        vec3 p=ro+rd*t;
        float d=field(p);
        if(d>.015) {
            float shadow=0.;
            for(int j=1;j<=4;j++) {
                float distance=float(j)*.19;
                shadow += field(p+light*distance)*.19;
            }
            float illumination=exp(-shadow*3.2);
            float alpha=1.-exp(-d*dt*2.7);
            float fill=exp(-field(p+vec3(.15,.3,.45))*.65);
            vec3 lighting=vec3(.06,.069,.08)+vec3(.19,.205,.23)*fill
                +vec3(.94,.96,1.)*illumination*.72;
            radiance+=transmittance*alpha*lighting;
            transmittance*=1.-alpha;
        }
        t+=dt;
    }
    // Premultiplied alpha preserves wisps over the existing star layers.
    float alpha=(1.-transmittance)*strength;
    color=vec4(radiance*strength,alpha);
}
`;

type Cloud = { phase: number; size: number };
type CloudPass = {
    c: Cloud; i: number; cycle: number; progress: number; hero: boolean;
    distance: number;
};

/** Mount an optional atmosphere. Missing WebGL leaves the black starfield intact. */
export function mountClouds(canvas: HTMLCanvasElement, foreground: HTMLCanvasElement | null = null): () => void {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: "low-power" });
    if (!gl) return () => {};
    const shaders: WebGLShader[] = [];
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn("Cloud shader unavailable:", gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            shaders.forEach(s => gl.deleteShader(s));
            gl.deleteProgram(program);
            return () => {};
        }
        shaders.push(shader);
        gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program);
        return () => {};
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    const uniforms = Object.fromEntries(["resolution","center","scale","rotation","time","seed","strength","formation","steps"].map(n => [n,gl.getUniformLocation(program,n)]));
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, texture);
    // Seeded noise makes visual checks repeatable and avoids a new sky per visit.
    const noise = new Uint8Array(32**3);
    let random = 47219;
    for(let i=0;i<noise.length;i++) { random = (Math.imul(random,1664525)+1013904223)|0; noise[i]=random>>>24; }
    gl.texImage3D(gl.TEXTURE_3D,0,gl.R8,32,32,32,0,gl.RED,gl.UNSIGNED_BYTE,noise);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    for(const axis of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D,axis,gl.REPEAT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const clouds: Cloud[] = [
        {phase:.18,size:2.3},
        {phase:.42,size:3.3},
        {phase:.66,size:3.7},
    ];
    const frontContext=foreground?.getContext("2d");
    // The fixed contact panel is revealed beneath the page, not scrolled
    // through it; its constant screen position must not hold a curtain open.
    const sections=Array.from(document.querySelectorAll<HTMLElement>("[data-section]:not(#home)"))
        .filter(section=>getComputedStyle(section).position!=="fixed");
    let entrance=0;
    let width=0, height=0, frame=0, last=0, elapsed=0, disposed=false;
    const resize = () => {
        const w=canvas.clientWidth, h=canvas.clientHeight;
        if(w===width && (!desktop.matches || h===height)) return;
        width=w; height=h;
        // Cap fill-rate; phone clouds are a single still volume, redrawn on scroll.
        const ratio=Math.min(devicePixelRatio,desktop.matches ? .7 : .5,1280/w,900/h);
        canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
        gl.viewport(0,0,canvas.width,canvas.height);
        if(foreground) { foreground.width=canvas.width; foreground.height=canvas.height; }
        last=0;
    };
    let previousScroll=-1;
    const render = (now: number) => {
        if(disposed) return;
        frame=requestAnimationFrame(render);
        if(document.hidden || now-last<1000/30) return;
        const scroll=reduced.matches ? 0 : window.scrollY/height;
        const animate=desktop.matches && !reduced.matches;
        if(!animate && scroll===previousScroll && last!==0) return;
        if(animate) elapsed+=last ? Math.min((now-last)/1000,.1) : 0;
        const life=animate ? elapsed : 0;
        if(scroll!==previousScroll || last===0) {
            entrance=animate ? Math.max(0,...sections.map(section=> {
                const top=section.getBoundingClientRect().top/height;
                return top>.15 && top<.9 ? Math.sin((top-.15)/.75*Math.PI)**2 : 0;
            })) : 0;
        }
        const opening=animate ? Math.min(1,scroll/1.15) : 1;
        const openingVeil=opening<1 ? .12*(1-opening)+.75*Math.sin(opening*Math.PI) : 0;
        const veil=Math.max(entrance*.65,openingVeil);
        last=now; previousScroll=scroll;
        gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
        gl.uniform1i(uniforms.steps,desktop.matches?64:40);
        const active=desktop.matches?clouds:[clouds[0]];
        // Back-to-front ordering changes as volumes pass and recycle.
        const ordered: CloudPass[]=active.map((c,i)=> {
            const travel=scroll/(9+i*2)+c.phase;
            const progress=(travel%1)/.72;
            return {c,i,cycle:Math.floor(travel),progress,hero:false,
                distance:[16,22,29][i]-[12,15,15][i]*progress};
        }).filter(c=>c.progress<1);
        if(animate && opening<1) {
            ordered.push({c:{phase:0,size:3.1},i:3,cycle:0,progress:opening,
                hero:true,distance:10.-8.*opening**1.35});
        }
        ordered.sort((a,b)=>b.distance-a.distance);
        let nearBlur=0;
        let nearest: { x: number; y: number; radius: number; depth: number } | null=null;
        gl.disable(gl.SCISSOR_TEST);
        gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.SCISSOR_TEST);
        for(const {c,i,cycle,progress,hero,distance} of ordered) {
            // Keep a distant cloud behind the opening volume. Bring the next
            // near cloud in through condensation, without adding a curtain pass.
            const ambientFormation=animate && i===0 ? Math.max(0,Math.min(1,(scroll-.85)/.5)) : 1;
            if(!hero && ambientFormation===0) continue;
            // New paths and proportions on later passes, deterministic in both
            // scroll directions. The long invisible interval leaves black space.
            const variation=(Math.sin((cycle*7+i+1)*12.9898)*43758.5453)%1;
            const size=c.size*(1+Math.abs(variation)*.18)*(desktop.matches?1.12:.4);
            const phase=i*1.7;
            const depth=distance+.22*Math.sin(life*.055+phase);
            const edge=desktop.matches ? 2.6+width/height*.75 : .95;
            const paths=[[-edge,-1.7],[edge,2.1],[-1.3,3.6],[1.6,-3.5]];
            const path=hero ? [-1.8-progress*progress*1.4,-.5-progress*.7]
                : desktop.matches ? paths[(cycle+i)%paths.length] : paths[0];
            const worldX=path[0]+.25*variation+.14*Math.sin(life*.045+phase);
            const worldY=path[1]+.4*Math.sin(progress*Math.PI+phase)+.12*Math.sin(life*.06+phase);
            // Keep turns barely perceptible so density evolution and drift
            // carry the movement without making clouds look like rigid objects.
            const yaw=progress*.26+i*.8+.056*Math.sin(life*.06+phase);
            const pitch=Math.sin(progress*Math.PI)*.076+.036*Math.sin(life*.047+phase);
            const roll=.02*Math.sin(life*.039+phase);
            gl.uniform1f(uniforms.time,scroll*7.+life*(.9+i*.14));
            const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
            const rotation=new Float32Array([cy,0,-sy, sy*sx,cx,cy*sx, sy*cx,-sx,cy*cx]);
            const cr=Math.cos(roll),sr=Math.sin(roll);
            for(let column=0;column<3;column++) {
                const x=rotation[column*3],y=rotation[column*3+1];
                rotation[column*3]=cr*x-sr*y;
                rotation[column*3+1]=sr*x+cr*y;
            }
            gl.uniformMatrix3fv(uniforms.rotation,false,rotation);
            const bounds=[Infinity,Infinity,-Infinity,-Infinity];
            for(const bx of [-1,1]) for(const by of [-1,1]) for(const bz of [-1,1]) {
                const x=bx*size*1.5,y=by*size*.8*1.15,z=bz*size*.8*1.15;
                const rx=rotation[0]*x+rotation[3]*y+rotation[6]*z;
                const ry=rotation[1]*x+rotation[4]*y+rotation[7]*z;
                const rz=rotation[2]*x+rotation[5]*y+rotation[8]*z;
                const distance=Math.max(.1,depth-rz);
                const px=((worldX+rx)*1.8/distance/(width/height)+1)*canvas.width/2;
                const py=((worldY+ry)*1.8/distance+1)*canvas.height/2;
                bounds[0]=Math.min(bounds[0],px);bounds[1]=Math.min(bounds[1],py);
                bounds[2]=Math.max(bounds[2],px);bounds[3]=Math.max(bounds[3],py);
            }
            const left=Math.max(0,Math.floor(bounds[0])),bottom=Math.max(0,Math.floor(bounds[1]));
            const right=Math.min(canvas.width,Math.ceil(bounds[2])),top=Math.min(canvas.height,Math.ceil(bounds[3]));
            if(right<=left || top<=bottom) continue;
            gl.scissor(left,bottom,right-left,top-bottom);
            gl.uniform3f(uniforms.center,worldX,worldY,6-depth);
            gl.uniform3f(uniforms.scale,size,size*.8,size*.8);
            gl.uniform1f(uniforms.seed,i*.193+cycle*.137);
            const growth=hero ? Math.min(1,(1-progress)/.22)
                : Math.max(0,Math.min(1,progress/.2,(1-progress)/.18))*ambientFormation;
            gl.uniform1f(uniforms.formation,growth*growth*(3-2*growth));
            gl.uniform1f(uniforms.strength,desktop.matches ? .98 : .6);
            gl.drawArrays(gl.TRIANGLES,0,6);
            nearBlur=Math.max(nearBlur,Math.max(0,7.-depth)*.6);
            if(growth>.25 && (!nearest || depth<nearest.depth)) {
                nearest={x:(worldX*1.8/depth/(width/height)+1)*canvas.width/2,
                    y:(1-worldY*1.8/depth)*canvas.height/2,
                    radius:size*1.8/depth*canvas.height*.75,depth};
            }
        }
        canvas.style.filter=nearBlur>.05 ? `blur(${nearBlur.toFixed(2)}px)` : "none";
        if(foreground && frontContext) {
            const cover=nearest && nearest.depth<10 && veil>.01;
            foreground.style.opacity=cover ? "1" : "0";
            foreground.style.filter=canvas.style.filter;
            frontContext.clearRect(0,0,foreground.width,foreground.height);
            if(cover && nearest) {
                // Reuse the existing nearest cloud. Expand a soft spatial mask,
                // not its global opacity: dense cores can actually cover text.
                frontContext.drawImage(canvas,0,0);
                const radius=Math.max(1,nearest.radius*Math.sqrt(veil));
                const mask=frontContext.createRadialGradient(nearest.x,nearest.y,radius*.6,
                    nearest.x,nearest.y,radius);
                mask.addColorStop(0,"rgba(0,0,0,1)");
                mask.addColorStop(1,"rgba(0,0,0,0)");
                frontContext.globalCompositeOperation="destination-in";
                frontContext.fillStyle=mask;
                frontContext.fillRect(0,0,foreground.width,foreground.height);
                frontContext.globalCompositeOperation="source-over";
            }
        }

    };
    const reset = () => {last=0;previousScroll=-1;};
    let contextLost = false;
    const lost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame);
    };
    resize();frame=requestAnimationFrame(render);
    window.addEventListener("resize",resize);
    document.addEventListener("visibilitychange",reset);
    reduced.addEventListener("change",reset);
    canvas.addEventListener("webglcontextlost",lost);
    return () => {
        disposed=true;cancelAnimationFrame(frame);
        window.removeEventListener("resize",resize);
        document.removeEventListener("visibilitychange",reset);
        reduced.removeEventListener("change",reset);canvas.removeEventListener("webglcontextlost",lost);
        // Lost-context resources are already invalid, including after restoration.
        if (!contextLost) {
            gl.deleteTexture(texture);gl.deleteBuffer(buffer);
            shaders.forEach(s=>gl.deleteShader(s));gl.deleteProgram(program);
        }
    };
}
