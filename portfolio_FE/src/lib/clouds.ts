/** Ray-marched cloud volumes with light absorption and a secondary shadow march.
 * A small, repeating 3D noise texture supplies detail without remote assets.
 * Scroll drives approach; slow independent drift, rotation and density changes
 * keep desktop clouds alive at rest. World-space positions preserve perspective.
 */
import { gleamFlight, spectralPaths } from "./prismOptics";

// Shared verbatim by the cloud and clear-space material. There is only one
// spectral footprint, transform, head and displacement for the entire flight.
const opticalField = `
uniform vec3 beamCenter;
uniform vec3 beamScale;
uniform mat3 beamRotation;
uniform vec4 spectralRays[7];
uniform float gleam;
uniform float gleamProgress;
uniform float gleamHead;
uniform float gleamOffset;
vec3 beamLocal(vec3 world) {
    return (transpose(beamRotation)*(world-beamCenter))/beamScale;
}
vec3 opticalLight(vec3 p) {
    vec3 bands[7] = vec3[7](vec3(.24,.06,1.), vec3(.03,.32,1.),
        vec3(.02,.78,.65), vec3(.3,1.,.07), vec3(1.,.74,.02),
        vec3(1.,.27,.01), vec3(.85,.06,.01));
    // Translate the complete prism-shaped packet, not seven diverging rays.
    p.xy-=normalize(spectralRays[3].zw)*gleamOffset;
    if(abs(p.z-.27)>.8 || length(p.xy-spectralRays[3].xy)>1.85) return vec3(0.);
    vec3 sum=vec3(0.);
    for(int k=0;k<7;k++) {
        vec4 ray=spectralRays[k];
        if(dot(ray.zw,ray.zw)<.5) continue;
        vec2 q=p.xy-ray.xy;
        float along=dot(q,ray.zw);
        float across=q.x*ray.w-q.y*ray.z;
        float grown=smoothstep(0.,1.,gleamProgress);
        float width=(.012+max(along,0.)*.018)*mix(.35,1.,grown);
        float profile=exp(-.5*across*across/(width*width));
        profile+=.11*grown*exp(-.5*across*across/.012);
        float gate=smoothstep(-.02,.055,along)
            *(1.-smoothstep(gleamHead,gleamHead+.09,along));
        float depth=exp(-pow((p.z-.27)/.19,2.));
        sum+=bands[k]*profile*gate*depth;
    }
    return sum/vec3(3.44,3.23,2.76);
}
vec3 lightResponse(vec3 energy) { return 1.-exp(-energy*1.6); }
`;

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
${opticalField}
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
            if(gleam>0.) {
                // Dense cloud both receives and blocks light. Approximate
                // source-path extinction along the central traced ray.
                vec3 towardSource=normalize((transpose(rotation)*beamRotation
                    *(vec3(-spectralRays[3].zw,0.)*beamScale))/scale);
                float blocked=field(p+towardSource*.16)*.16
                    +field(p+towardSource*.34)*.18;
                vec3 world=center+rotation*(p*scale);
                vec3 beam=lightResponse(opticalLight(beamLocal(world))*exp(-blocked*1.7));
                lighting+=beam*gleam*3.;
            }
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
// Chromatic pass, adapted from Aceternity's Chromatic Image: the rendered sky
// is resampled per channel along the pointer direction, with a banded warp and
// a slight zoom. Channels are premultiplied, so alpha takes the widest sample
// and the red/blue fringes survive past the cloud edge over the starfield.
const chromaticFragment = `#version 300 es
precision highp float;
uniform sampler2D scene;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float progress;
uniform vec3 cover;
uniform float coverAmount;
${opticalField}
uniform int layer;
out vec4 color;
const float zoom=.2, displacement=.05, chromatic=.01;
vec3 clearSpaceLight(vec2 uv) {
    if(gleam<=0.) return vec3(0.);
    vec2 screen=uv*2.-1.;
    screen.x*=resolution.x/resolution.y;
    vec3 ro=beamLocal(vec3(0.,0.,6.));
    vec3 rd=(transpose(beamRotation)*normalize(vec3(screen,-1.8)))/beamScale;
    if(abs(rd.z)<.00001) return vec3(0.);
    float t=(.27-ro.z)/rd.z;
    if(t<=0.) return vec3(0.);
    // Same plane, same spectral footprint, same exposure curve as in the
    // cloud. This is its unobscured radiance, not a second outgoing beam.
    return lightResponse(opticalLight(ro+rd*t))*gleam;
}
void main() {
    vec2 uv=gl_FragCoord.xy/resolution;
    vec2 movement=(pointer-.5)*vec2(resolution.x/resolution.y,1.);
    vec2 direction=movement/max(length(movement),.2);
    vec2 base=mix(uv,vec2(.5),zoom*progress*.28);
    float band=sin(uv.y*24.+pointer.x*5.);
    float fineBand=sin(uv.y*71.-pointer.y*4.);
    base.x+=(band*.72+fineBand*.28)*displacement*progress*.16;
    base.y+=direction.y*displacement*progress*.12;
    vec2 split=direction*chromatic*progress;
    split.x+=band*chromatic*progress*.35;
    vec4 red=texture(scene,base+split), green=texture(scene,base), blue=texture(scene,base-split);
    vec4 raw=vec4(red.r,green.g,blue.b,max(green.a,max(red.a,blue.a)));
    // The sky's overall opacity lives here, not in CSS, so the front copy
    // and the sky behind it always share one look.
    vec4 sky=raw*.85;
    // Layer 1 is the copy passed in front of the page, at full strength like
    // the original cover. It follows the cloud's own density (thin haze is
    // never lifted) under a wide, soft reach, so the thickened cloud has no
    // geometric edge - an even copy inside a firm round mask read as a disc.
    float reach=1.-smoothstep(cover.z*.3,cover.z*1.4,distance(gl_FragCoord.xy,cover.xy));
    float lift=coverAmount*reach*smoothstep(.15,.7,raw.a);
    if(layer==0 && gleam>0.) {
        // Resample at exactly the same coordinates as the cloud, including
        // its chromatic warp. Cloud opacity occludes the clear-space view;
        // its volume already supplies the scattered view of this light.
        vec3 beam=vec3(clearSpaceLight(base+split).r*(1.-red.a),
            clearSpaceLight(base).g*(1.-green.a),
            clearSpaceLight(base-split).b*(1.-blue.a));
        sky.rgb+=beam*.85;
        sky.a=max(sky.a,max(beam.r,max(beam.g,beam.b))*.85);
    }
    color=layer==1 ? raw*lift : sky;
}
`;

type Cloud = { phase: number; size: number };
type CloudPass = {
    c: Cloud; i: number; cycle: number; progress: number; hero: boolean;
    finale: boolean; distance: number;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const s = clamp01(v); return s * s * (3 - 2 * s); };

// One transform implementation for both the weather and the launch frame.
// The launch frame is evaluated at a fixed scroll position, so reloads,
// fast scrolling, reversing and resizing cannot capture a different beam.
function cloudPose(pass: CloudPass, desktop: boolean, aspect: number, life: number) {
    const {c,i,cycle,progress,hero,finale,distance}=pass;
    const variation=(Math.sin((cycle*7+i+1)*12.9898)*43758.5453)%1;
    const mobileScale=hero ? .78 : finale ? .58 : .38;
    const size=c.size*(1+Math.abs(variation)*.18)*(desktop?1.12:mobileScale);
    const phase=i*1.7;
    const depth=distance+.22*Math.sin(life*.055+phase);
    const edge=desktop ? 2.6+aspect*.75 : .95;
    const paths=[[-edge,-1.7],[edge,2.1],[-1.3,3.6],[1.6,-3.5]];
    const mobileHeroExit=!desktop ? smooth((progress-.78)/.22)*3.4 : 0;
    const path=hero ? [-.1-progress*.25,.95-progress*.8-mobileHeroExit]
        : finale ? [.8+progress*.4,4.6-progress*.9]
        : desktop ? paths[(cycle+i)%paths.length]
        : [-1.35+progress*3.6,-1.35];
    const worldX=path[0]+.25*variation+.14*Math.sin(life*.045+phase);
    const worldY=path[1]+.4*Math.sin(progress*Math.PI+phase)+.12*Math.sin(life*.06+phase);
    const yaw=progress*.26+i*.8+.056*Math.sin(life*.06+phase);
    const pitch=Math.sin(progress*Math.PI)*.076+.036*Math.sin(life*.047+phase);
    const roll=.02*Math.sin(life*.039+phase);
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
    const rotation=new Float32Array([cy,0,-sy, sy*sx,cx,cy*sx, sy*cx,-sx,cy*cx]);
    const cr=Math.cos(roll),sr=Math.sin(roll);
    for(let column=0;column<3;column++) {
        const x=rotation[column*3],y=rotation[column*3+1];
        rotation[column*3]=cr*x-sr*y;
        rotation[column*3+1]=sr*x+cr*y;
    }
    return {size,depth,worldX,worldY,rotation};
}

/** Mount an optional atmosphere. Missing WebGL leaves the black starfield intact. */
export function mountClouds(canvas: HTMLCanvasElement, foreground: HTMLCanvasElement | null = null): () => void {
    const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: "low-power" });
    if (!gl) return () => {};
    const shaders: WebGLShader[] = [];
    const programs: WebGLProgram[] = [];
    const link = (source: string) => {
        const program = gl.createProgram()!;
        programs.push(program);
        // Both passes share one quad buffer, so pin the attribute slot.
        gl.bindAttribLocation(program, 0, "position");
        for (const [type, text] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, source]] as const) {
            const shader = gl.createShader(type)!;
            shaders.push(shader);
            gl.shaderSource(shader, text);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.warn("Cloud shader unavailable:", gl.getShaderInfoLog(shader));
                return null;
            }
            gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
    };
    const program = link(fragment);
    const chromaticProgram = program && link(chromaticFragment);
    if (!program || !chromaticProgram) {
        shaders.forEach(s => gl.deleteShader(s)); programs.forEach(p => gl.deleteProgram(p));
        return () => {};
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    const attribute = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    const opticalUniformNames=["gleam","gleamProgress","gleamHead","gleamOffset","beamCenter","beamScale","beamRotation","spectralRays[0]"];
    const uniforms = Object.fromEntries(["resolution","center","scale","rotation","time","seed","strength","formation","steps",...opticalUniformNames].map(n => [n,gl.getUniformLocation(program,n)]));
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
    // Clouds render into an offscreen texture (unit 1); the chromatic pass
    // resamples it onto the canvas. Sized in resize().
    const sceneTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE0);
    const sceneBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER,sceneBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,sceneTexture,0);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    const chromaticUniforms = Object.fromEntries(["scene","resolution","pointer","progress","cover","coverAmount","layer",...opticalUniformNames].map(n => [n,gl.getUniformLocation(chromaticProgram,n)]));
    gl.useProgram(chromaticProgram);
    gl.uniform1i(chromaticUniforms.scene,1);
    gl.useProgram(program);
    // A faint split always drifts around the sky; mouse movement and scroll
    // speed each add a little more, and both ease back to the ambient level.
    const chroma={x:.5,y:.5,targetX:.5,targetY:.5,progress:0,mouse:0,scroll:0,time:0,moved:-Infinity};
    const pointerMove = (event: PointerEvent) => {
        if(event.pointerType==="touch") return;
        chroma.targetX=event.clientX/window.innerWidth;
        chroma.targetY=1-event.clientY/window.innerHeight;
        chroma.moved=performance.now();
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    // Two large ambient volumes read as weather; more, smaller ones read as debris.
    const clouds: Cloud[] = [
        {phase:.18,size:3.6},
        {phase:.58,size:4.4},
    ];
    const frontContext=foreground?.getContext("2d");
    // The cover eases toward its target each frame so a cloud never snaps
    // over or off the content when the nearest volume changes.
    const cover={x:0,y:0,radius:0,amount:0};
    let frontVisible=false;
    // The fixed contact panel is revealed beneath the page, not scrolled
    // through it; its constant screen position must not hold a curtain open.
    const sections=Array.from(document.querySelectorAll<HTMLElement>("[data-section]:not(#home)"))
        .filter(section=>getComputedStyle(section).position!=="fixed");
    let entrance=0, pageEnd=Infinity;
    let width=0, height=0, frame=0, last=0, elapsed=0, disposed=false;
    const resize = () => {
        const w=canvas.clientWidth, h=canvas.clientHeight;
        if(w===width && (!desktop.matches || h===height)) return;
        width=w; height=h;
        // Cap fill-rate. Mobile uses one volume at a time and only redraws
        // while scroll changes, so the large hero pass stays affordable.
        const ratio=Math.min(devicePixelRatio,desktop.matches ? .7 : .45,1280/w,900/h);
        canvas.width=Math.round(width*ratio); canvas.height=Math.round(height*ratio);
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.activeTexture(gl.TEXTURE1);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,canvas.width,canvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        gl.activeTexture(gl.TEXTURE0);
        if(foreground) { foreground.width=canvas.width; foreground.height=canvas.height; }
        last=0;
    };
    let previousScroll=-1;
    const journey=document.querySelector<HTMLElement>("#journey");
    let opticalProgress=0;
    const render = (now: number) => {
        if(disposed) return;
        frame=requestAnimationFrame(render);
        const frameInterval=1000/(desktop.matches ? 30 : 24);
        if(document.hidden || (last!==0 && now-last<frameInterval)) return;
        // iOS rubber-band scrolling can report a negative scrollY above the
        // document. Keep that region pinned to the hero's initial state;
        // fractional powers of a negative progress otherwise become NaN and
        // make the cloud disappear during a downward pull at the top.
        const scroll=reduced.matches ? 0 : Math.max(0,window.scrollY/height);
        const motion=!reduced.matches;
        const idleAnimate=desktop.matches && motion;
        const step=last ? Math.min((now-last)/1000,.1) : 0;
        // Quick to rise, slow to settle, so the split never snaps on or off.
        const approach=(value: number, target: number)=>
            value+(target-value)*(1-Math.exp(-step*(target>value ? 6 : 1.8)));
        const mouseActive=desktop.matches && now-chroma.moved<140;
        const scrollSpeed=last!==0 && previousScroll>=0
            ? Math.abs(scroll-previousScroll)/Math.max(step,1/60) : 0;
        chroma.mouse=approach(chroma.mouse,mouseActive ? 1 : 0);
        chroma.scroll=approach(chroma.scroll,clamp01(scrollSpeed/1.5));
        if(motion) chroma.time+=step;
        if(!mouseActive) {
            // At rest the split direction wanders on a slow orbit.
            chroma.targetX=.5+.38*Math.cos(chroma.time*.11);
            chroma.targetY=.5+.38*Math.sin(chroma.time*.083);
        }
        const follow=1-Math.exp(-step*(mouseActive ? 8 : 1.5));
        chroma.x+=(chroma.targetX-chroma.x)*follow;
        chroma.y+=(chroma.targetY-chroma.y)*follow;
        chroma.progress=motion
            ? .12+.05*Math.sin(chroma.time*.37)+chroma.mouse*.15+chroma.scroll*.1 : 0;
        if(!motion && scroll===previousScroll && last!==0) return;
        // The ambient shimmer keeps mobile drawing, but between scroll changes
        // it only resamples the cached clouds instead of ray-marching again.
        const journeyTop=journey ? journey.getBoundingClientRect().top/height : Infinity;
        const opticalTarget=motion ? Math.max(0,(1.4-journeyTop)/2.) : 0;
        const opticalMoving=Math.abs(opticalTarget-opticalProgress)>.0005;
        opticalProgress=last===0 || !motion ? opticalTarget
            : opticalProgress+(opticalTarget-opticalProgress)*(1-Math.exp(-step*10));
        const flight=gleamFlight(opticalProgress);
        const opticalActive=motion && opticalProgress>.02;
        const sceneDirty=idleAnimate || opticalMoving || scroll!==previousScroll || last===0;
        if(idleAnimate) elapsed+=step;
        const life=idleAnimate ? elapsed : 0;
        if(scroll!==previousScroll || last===0) {
            entrance=idleAnimate ? Math.max(0,...sections.map(section=> {
                const top=section.getBoundingClientRect().top/height;
                return top>.15 && top<.9 ? Math.sin((top-.15)/.75*Math.PI)**2 : 0;
            })) : 0;
            pageEnd=(document.documentElement.scrollHeight-window.innerHeight)/height;
        }
        const opening=motion ? Math.min(1,scroll/1.15) : 1;
        // Only section entrances lift a cloud in front of the content; the
        // hero exit leaves ROOS inflating through the cloud on its own.
        const veil=entrance*.65;
        // The closing volume forms over the last screens and settles along
        // the top edge once the contact panel is revealed.
        const closing=motion ? clamp01((scroll-(pageEnd-1.3))/1.3) : 0;
        last=now; previousScroll=scroll;
        gl.bindFramebuffer(gl.FRAMEBUFFER,sceneBuffer);
        gl.useProgram(program);
        gl.enable(gl.BLEND);
        gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
        gl.uniform1i(uniforms.steps,desktop.matches?64:32);
        const active=desktop.matches?clouds:[clouds[0]];
        // Back-to-front ordering changes as volumes pass and recycle.
        const ambientPasses=(atScroll: number): CloudPass[]=>active.map((c,i)=> {
            const travel=atScroll/(9+i*2)+c.phase;
            const progress=(travel%1)/.72;
            return {c,i,cycle:Math.floor(travel),progress,hero:false,finale:false,
                distance:[17,26][i]-[13,17][i]*progress};
        }).filter(c=>c.progress<1);
        const ordered=ambientPasses(scroll);
        // Pick the existing front cloud halfway through the original birth
        // interval. The light owns this world frame for its entire flight;
        // crossing the cloud edge never changes its position or velocity.
        const launchScroll=Math.max(0,scroll+journeyTop-.6);
        const carrier=ambientPasses(launchScroll).sort((a,b)=>a.distance-b.distance)[0];
        const launch=carrier && cloudPose(carrier,desktop.matches,width/height,0);
        const beamPaths=carrier ? spectralPaths(carrier.progress) : new Float32Array(28);
        const uploadLight=(locations: Record<string,WebGLUniformLocation|null>)=> {
            gl.uniform1f(locations.gleam,opticalActive && launch ? 1 : 0);
            if(!launch) return;
            gl.uniform1f(locations.gleamProgress,flight.growth);
            gl.uniform1f(locations.gleamHead,flight.head);
            gl.uniform1f(locations.gleamOffset,flight.offset);
            gl.uniform3f(locations.beamCenter,launch.worldX,launch.worldY,6-launch.depth);
            gl.uniform3f(locations.beamScale,launch.size,launch.size*.8,launch.size*.8);
            gl.uniformMatrix3fv(locations.beamRotation,false,launch.rotation);
            gl.uniform4fv(locations["spectralRays[0]"],beamPaths);
        };
        uploadLight(uniforms);
        if(motion && opening<1) {
            // Rests large behind the logo, then rushes the camera and passes
            // through it before dispersing to expose the page.
            ordered.push({c:{phase:0,size:3.6},i:3,cycle:0,progress:opening,
                hero:true,finale:false,distance:9.5-8.5*opening**1.3});
        }
        if(closing>0) {
            ordered.push({c:{phase:0,size:3.4},i:4,cycle:0,progress:closing,
                hero:false,finale:true,distance:19.-11.5*closing**1.2});
        }
        ordered.sort((a,b)=>b.distance-a.distance);
        let nearBlur=0;
        let nearest: { x: number; y: number; radius: number; depth: number } | null=null;
        if(sceneDirty) {
            gl.disable(gl.SCISSOR_TEST);
            gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.enable(gl.SCISSOR_TEST);
        for(const pass of ordered) {
            const {i,cycle,progress,hero,finale}=pass;
            // Ambient weather stays out of the opening and dissolves while the
            // closing volume forms, so the logo and the contact form stay clear.
            // Mobile is deliberately sequential: hero, one ambient pass,
            // then the closing cloud. No two ray-marched volumes overlap.
            const ambientFormation=motion
                ? smooth((scroll-(desktop.matches?.85:1.1))/.5)*(1-smooth(closing))
                : 1;
            if(!desktop.matches && (opening<1 || closing>0)) {
                if(!hero && !finale) continue;
            }
            if(!hero && !finale && ambientFormation===0) continue;
            const {size,depth,worldX,worldY,rotation}=cloudPose(pass,desktop.matches,width/height,life);
            gl.uniform1f(uniforms.time,scroll*7.+life*(.9+i*.14));
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
            const growth=hero ? (desktop.matches ? smooth((1-progress)/.18) : 1)
                : finale ? smooth(progress/.35)
                : desktop.matches
                    ? smooth(Math.min(progress/.2,(1-progress)/.18))*ambientFormation
                    : smooth(progress/.18)*ambientFormation;
            gl.uniform1f(uniforms.formation,growth*growth*(3-2*growth));
            const strength=hero ? .72+.26*smooth(progress/.35)
                : finale ? .85 : desktop.matches ? .98 : .6;
            gl.uniform1f(uniforms.strength,strength);
            if(sceneDirty) gl.drawArrays(gl.TRIANGLES,0,6);
            nearBlur=Math.max(nearBlur,Math.max(0,7.-depth)*.6);
            if(growth>.1 && (!nearest || depth<nearest.depth)) {
                nearest={x:(worldX*1.8/depth/(width/height)+1)*canvas.width/2,
                    y:(1-worldY*1.8/depth)*canvas.height/2,
                    radius:size*1.8/depth*canvas.height*.75,depth};
            }
        }
        // Proximity and veil both ramp, so the cover fades in and out
        // instead of switching at a depth threshold.
        const proximity=nearest ? clamp01((11-nearest.depth)/2.5) : 0;
        const ease=idleAnimate ? 1-Math.exp(-step*7) : 1;
        cover.amount+=(proximity*smooth(veil/.3)-cover.amount)*ease;
        if(nearest) {
            const follow=cover.amount<.02 ? 1 : ease;
            cover.x+=(nearest.x-cover.x)*follow;
            cover.y+=(nearest.y-cover.y)*follow;
            cover.radius+=(nearest.radius-cover.radius)*follow;
        }
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.BLEND);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);
        gl.useProgram(chromaticProgram);
        gl.uniform2f(chromaticUniforms.resolution,canvas.width,canvas.height);
        gl.uniform2f(chromaticUniforms.pointer,chroma.x,chroma.y);
        gl.uniform1f(chromaticUniforms.progress,chroma.progress);
        // cover.y runs down from the top; gl_FragCoord runs up from the bottom.
        gl.uniform3f(chromaticUniforms.cover,cover.x,canvas.height-cover.y,
            Math.max(1,cover.radius*Math.sqrt(Math.max(veil,.05))));
        gl.uniform1f(chromaticUniforms.coverAmount,cover.amount);
        uploadLight(chromaticUniforms);
        const covering=cover.amount>.01;
        if(covering && foreground && frontContext) {
            // Draw the lifted copy, hand it to the front canvas, then draw
            // the whole sky behind the page. The copy over the sky thickens
            // the nearest cloud as it rolls over the content.
            gl.uniform1i(chromaticUniforms.layer,1);
            gl.drawArrays(gl.TRIANGLES,0,6);
            frontContext.clearRect(0,0,foreground.width,foreground.height);
            frontContext.drawImage(canvas,0,0);
            gl.uniform1i(chromaticUniforms.layer,0);
            frontVisible=true;
        } else {
            gl.uniform1i(chromaticUniforms.layer,0);
            if(frontVisible && foreground && frontContext) {
                frontContext.clearRect(0,0,foreground.width,foreground.height);
            }
            frontVisible=false;
        }
        gl.drawArrays(gl.TRIANGLES,0,6);
        // Upscaling the low-resolution mobile buffer already softens it.
        // Avoid filtering a full-screen canvas on every scroll frame there.
        canvas.style.filter=desktop.matches && nearBlur>.05
            ? `blur(${nearBlur.toFixed(2)}px)` : "none";
        if(foreground) foreground.style.filter=canvas.style.filter;
    };
    const reset = () => {last=0;previousScroll=-1;};
    let contextLost = false;
    const lost = (event: Event) => {
        event.preventDefault();
        contextLost = true;
        cancelAnimationFrame(frame);
    };
    resize();render(performance.now());
    window.addEventListener("resize",resize);
    window.addEventListener("pointermove",pointerMove,{passive:true});
    document.addEventListener("visibilitychange",reset);
    reduced.addEventListener("change",reset);
    canvas.addEventListener("webglcontextlost",lost);
    return () => {
        disposed=true;cancelAnimationFrame(frame);
        window.removeEventListener("resize",resize);
        window.removeEventListener("pointermove",pointerMove);
        document.removeEventListener("visibilitychange",reset);
        reduced.removeEventListener("change",reset);canvas.removeEventListener("webglcontextlost",lost);
        // Lost-context resources are already invalid, including after restoration.
        if (!contextLost) {
            gl.deleteTexture(texture);gl.deleteBuffer(buffer);
            gl.deleteTexture(sceneTexture);gl.deleteFramebuffer(sceneBuffer);
            shaders.forEach(s=>gl.deleteShader(s));programs.forEach(p=>gl.deleteProgram(p));
        }
    };
}
