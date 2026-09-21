/** Ray-marched cloud volumes with light absorption and a secondary shadow march.
 * A small, repeating 3D noise texture supplies detail without remote assets.
 * Scroll drives approach; slow independent drift, rotation and density changes
 * keep desktop clouds alive at rest. World-space positions preserve perspective.
 */
import { createLightBurst } from "./lightBurst";
import { GLEAM_PACE, gleamFlight, spectralPaths } from "./prismOptics";

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
uniform float gleamTail;
uniform float gleamStretch;
uniform float gleamFree;
uniform float gleamTime;
uniform float gleamPixel;
uniform float gleamGlint;
// White light runs in from this far behind the prism, along the central ray
// (the screen's left edge). Head, offset and tail are measured from there.
uniform float gleamLead;
vec3 beamLocal(vec3 world) {
    return (transpose(beamRotation)*(world-beamCenter))/beamScale;
}
// One light, two media. Inside a cloud (cloud = 1) it is the dense, blooming
// spectral packet, translated rigidly once formed. In open space (cloud = 0)
// nothing blooms: the same head is a fine white-hot ray inside a faint
// spectral glow, drawn out between the slower tail and the head.
vec3 opticalLight(vec3 p, float cloud, float glint) {
    vec3 bands[7] = vec3[7](vec3(.24,.06,1.), vec3(.03,.32,1.),
        vec3(.02,.78,.65), vec3(.3,1.,.07), vec3(1.,.74,.02),
        vec3(1.,.27,.01), vec3(.85,.06,.01));
    bool dense=cloud>.5;
    // Move the formed footprint, not seven diverging rays.
    vec2 origin=spectralRays[3].xy, forward=normalize(spectralRays[3].zw);
    vec2 offset=p.xy-origin;
    float run=dot(offset,forward)+gleamLead;
    float side=offset.x*forward.y-offset.y*forward.x;
    float body=dense ? run-gleamOffset : (run-gleamTail)*gleamStretch;
    if(abs(p.z-.27)>.8 || abs(side)>.75 || body<-.2 || body>gleamHead+.7) return vec3(0.);
    // The spectral footprint hangs off the prism, a lead's length into the body.
    vec2 s=origin+forward*(body-gleamLead)+vec2(forward.y,-forward.x)*side;
    float grown=smoothstep(0.,1.,gleamProgress);
    float depth=exp(-pow((p.z-.27)/.19,2.));
    // Open space: the ray narrows into a point and fades down its trail.
    float tip=1.-smoothstep(gleamHead-.45,gleamHead+.6,body);
    float slim=mix(.35,1.,grown)*(.3+.7*tip);
    vec3 sum=vec3(0.);
    for(int k=0;k<7;k++) {
        vec4 ray=spectralRays[k];
        if(dot(ray.zw,ray.zw)<.5) continue;
        vec2 q=s-ray.xy;
        float along=dot(q,ray.zw);
        float across=q.x*ray.w-q.y*ray.z;
        float profile, gate=smoothstep(-.02,.055,along);
        if(dense) {
            float width=(.012+max(along,0.)*.018)*mix(.35,1.,grown);
            profile=exp(-.5*across*across/(width*width));
            profile+=.11*grown*exp(-.5*across*across/.012);
            gate*=1.-smoothstep(gleamHead-gleamLead,gleamHead-gleamLead+.09,along);
        } else {
            // Open space shows the glow along the whole body, run-in included
            // (before the prism the bands still overlap: a near-white haze).
            float width=.034*slim;
            profile=.3*exp(-.5*across*across/(width*width));
            gate=smoothstep(-.02,.055,body)*tip;
        }
        sum+=bands[k]*profile*gate*depth;
    }
    sum/=vec3(3.44,3.23,2.76);
    // The dense look starts at the prism. The run-in before it belongs to
    // the open-space look alone (clearSpaceLight), cloud or no cloud.
    if(dense) return sum;
    // Every wavelength shares the ray's centre line, so the core is white.
    // Never finer than a pixel of the low-resolution sky: below that the
    // core dims instead of breaking into a crawling dashed line.
    float fine=.0075*slim, core=max(fine,gleamPixel);
    sum+=fine/core*exp(-.5*side*side/(core*core))*smoothstep(-.02,.055,body)*tip*depth;
    float flow=pow(clamp(body/max(gleamHead,.001),0.,1.),2.6);
    sum*=flow;
    // Glare belongs to the view, not to the light: it appears only where the
    // ray scatters toward the eye at the haze's bright angle (glint), so it
    // swells along the ray as the bright front crosses that zone and dies
    // away behind it, instead of riding the head as a fixed ball.
    float lit=smoothstep(-.02,.055,body)*tip*flow*grown*depth;
    float flare=.7*glint*glint*glint*exp(-.5*side*side/.0009)
        +.26*glint*exp(-.5*side*side/.0064);
    return sum+vec3(1.,.97,.93)*flare*lit;
}
vec3 lightResponse(vec3 energy) { return 1.-exp(-energy*1.6); }
// Where the view through uv meets the light's plane, in beam-local units. A
// miss lands far off in z, where the footprint's own bounds reject it.
vec3 onLightPlane(vec2 uv, vec3 ro) {
    vec2 screen=uv*2.-1.;
    screen.x*=resolution.x/resolution.y;
    vec3 rd=(transpose(beamRotation)*normalize(vec3(screen,-1.8)))/beamScale;
    float t=abs(rd.z)<.00001 ? -1. : (.27-ro.z)/rd.z;
    return t>0. ? ro+rd*t : vec3(0.,0.,1000.);
}
// 0 on the prism's light, 1 well clear of it. Lenses stand down inside this
// corridor, so the gleam travels through its cloud, and across the text,
// untouched: never thinned, dimmed or bent. The corridor is only as long as
// the light itself (the same run the footprint occupies, held or released)
// and grows in with its head. An endless one that switched on with the gleam cut a
// band through every lens on screen at once, from one frame to the next.
float offBeam(vec2 uv) {
    if(gleam<=0.) return 1.;
    vec3 onRay=onLightPlane(uv,beamLocal(vec3(0.,0.,6.)));
    vec2 forward=normalize(spectralRays[3].zw), offset=onRay.xy-spectralRays[3].xy;
    float side=abs(offset.x*forward.y-offset.y*forward.x), run=dot(offset,forward)+gleamLead;
    float from=mix(gleamOffset-.2,gleamTail-.2/gleamStretch,gleamFree);
    float to=mix(gleamOffset+gleamHead+.7,gleamTail+(gleamHead+.7)/gleamStretch,gleamFree);
    float along=smoothstep(from-.5,from,run)*(1.-smoothstep(to,to+.5,run));
    float corridor=(1.-smoothstep(.14,.6,side))*along*smoothstep(0.,.3,gleamHead+.12);
    return 1.-corridor;
}
`;

// Lenses: where loose text floats with no panel behind it (data-lens). Centre
// and half size in canvas pixels; the shape is a superellipse, so it never
// reads as a card. Each lens carries three strengths. lensPower bends the sky
// at its rim. lensDim darkens the cloud behind the text: clouds still pass
// behind and overlap everything, which is where the page's depth comes from.
// lensErode (data-lens="soft", the about passages) also thins the cloud
// itself a little in the volume pass, so that lens can dim far less and
// leave no visible patch.
const lensShape = `
uniform vec4 lenses[4];
uniform float lensPower[4];
uniform float lensDim[4];
uniform float lensErode[4];
// 0 at a lens's centre, 1 on its outline.
float lensRadius(int k, vec2 at) {
    vec2 q=(at-lenses[k].xy)/lenses[k].zw;
    vec2 q2=q*q;
    return sqrt(sqrt(dot(q2,q2)));
}
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
uniform float flash;
uniform vec3 flashAt;
${opticalField}
${lensShape}
out vec4 color;
// How strongly this pixel's line of sight passes a soft lens (set once in
// main). The cloud thins there with the same erosion that makes it form and
// disperse: haze and thin parts go, the body stays, so the cloud still
// passes behind the text and only loses its glare.
float erosion;
float lensErosion(vec2 at) {
    float thin=0.;
    for(int k=0;k<4;k++) {
        if(lensErode[k]<=0.) continue;
        thin=max(thin,(1.-smoothstep(.45,1.1,lensRadius(k,at)))*lensErode[k]);
    }
    return thin;
}
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
    float density = shape + (n-.52)*1.3 - (1.-formation)*1.6 - erosion*.6;
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
    erosion = lensErosion(gl_FragCoord.xy)*offBeam(gl_FragCoord.xy/resolution);
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
            if(flash>0.) {
                // Lightning inside the volume: brightest around the strike
                // and carried further through thin cloud than dense, so
                // the cores between it and the eye stay dark.
                vec3 away=p-flashAt;
                lighting+=vec3(.7,.82,1.)*flash*exp(-dot(away,away)/.4)*(.35+.65*fill)*1.9;
            }
            if(gleam>0.) {
                // Dense cloud both receives and blocks light. Approximate
                // source-path extinction along the central traced ray.
                vec3 towardSource=normalize((transpose(rotation)*beamRotation
                    *(vec3(-spectralRays[3].zw,0.)*beamScale))/scale);
                float blocked=field(p+towardSource*.16)*.16
                    +field(p+towardSource*.34)*.18;
                vec3 world=center+rotation*(p*scale);
                vec3 beam=lightResponse(opticalLight(beamLocal(world),1.,0.)*exp(-blocked*1.7));
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
precision highp sampler3D;
uniform sampler3D noiseVolume;
uniform sampler2D scene;
uniform vec2 resolution;
uniform vec2 pointer;
uniform float progress;
uniform vec3 cover;
uniform float coverAmount;
${opticalField}
uniform int layer;
${lensShape}
out vec4 color;
const float zoom=.2, displacement=.05, chromatic=.01;
// x: how clear the sky is here (0..1). yz: refraction offset, in uv.
vec3 lensField(vec2 at) {
    float clear=0.;
    vec2 bend=vec2(0.);
    for(int k=0;k<4;k++) {
        if(lensPower[k]<=0.) continue;
        float r=lensRadius(k,at);
        clear=max(clear,(1.-smoothstep(.5,1.,r))*lensDim[k]);
        float rim=smoothstep(.4,.82,r)*(1.-smoothstep(.82,1.12,r))*lensPower[k];
        bend+=normalize(at-lenses[k].xy+vec2(.0001))*rim;
    }
    return vec3(clear,bend);
}
// split is the sky's own chromatic offset, so the light takes the same red
// and blue fringing as the clouds around it. A ray this fine needs a wider
// split than a cloud for it to show, so the released light amplifies it.
// before: 1 where this is the run-in ahead of the prism, 0 from the prism on.
vec3 clearSpaceLight(vec2 uv, vec2 split, out float before) {
    before=0.;
    if(gleam<=0.) return vec3(0.);
    vec3 ro=beamLocal(vec3(0.,0.,6.));
    vec3 p=onLightPlane(uv,ro), warm=onLightPlane(uv+split,ro), cool=onLightPlane(uv-split,ro);
    // The run-in, before the prism, is already in open sky: it wears the
    // open-space look from the start, the same ray that leaves the cloud at
    // the other end (fine core, faint glow, the sky's split, the haze).
    float run=dot(p.xy-spectralRays[3].xy,normalize(spectralRays[3].zw))+gleamLead;
    before=1.-smoothstep(gleamLead-.25,gleamLead+.05,run);
    float open=max(gleamFree,before);
    // Until the light is released this is exactly the cloud's footprint seen
    // through its gaps. Released, it eases into the open-space ray.
    vec3 held=open<1. ? lightResponse(vec3(opticalLight(warm,1.,0.).r,
        opticalLight(p,1.,0.).g,opticalLight(cool,1.,0.).b)) : vec3(0.);
    if(open<=0.) return held*gleam;
    // Scattering angle between the light's heading and the line to the eye,
    // in world proportions. Haze favours one angle (gleamGlint, chosen so it
    // falls in open sky), and light heading more toward the viewer shows
    // brighter than light heading away.
    vec3 toEye=normalize((ro-p)*beamScale);
    float facing=dot(normalize(vec3(normalize(spectralRays[3].zw),0.)*beamScale),toEye);
    float glint=exp(-pow((facing-gleamGlint)/.05,2.));
    float phase=mix(.8,1.15,smoothstep(-.85,-.2,facing));
    // Light only shows where something scatters it. Past the cloud that is a
    // thin haze drifting through its path: it sways the view a touch and
    // thins and thickens along the flight, so the ray keeps shimmering at
    // rest and shifts as it travels instead of sliding by as a fixed shape.
    vec3 drift=vec3(gleamTime*.011,-gleamTime*.007,gleamTime*.009);
    vec3 h=p*vec3(.17,.3,.17)+drift;
    vec3 sway=vec3(vec2(texture(noiseVolume,h+.31).r,texture(noiseVolume,h.yzx+.67).r)-.5,0.)*.014;
    float haze=texture(noiseVolume,h*2.1-drift*2.3).r*.65
        +texture(noiseVolume,h*4.7+drift*3.1).r*.35;
    // A gentle exposure keeps the glow translucent: only the core runs hot.
    warm=onLightPlane(uv+split*2.5,ro);
    cool=onLightPlane(uv-split*2.5,ro);
    vec3 energy=vec3(opticalLight(warm+sway,0.,glint).r,
        opticalLight(p+sway,0.,glint).g,opticalLight(cool+sway,0.,glint).b);
    vec3 released=1.-exp(-energy*(.7+.6*haze)*phase*1.8);
    return mix(held,released,open)*gleam;
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
    // The rim draws its sky from nearer the lens centre and disperses it.
    // The prism's light keeps the unbent view: only the clouds refract.
    vec2 beamBase=base, beamSplit=split;
    vec3 lens=lensField(gl_FragCoord.xy);
    // Part of that light is scattered by cloud and so lives in the scene the
    // lens bends and dims: the lens stands down along the ray (offBeam).
    lens*=offBeam(base);
    base-=lens.yz*vec2(resolution.y/resolution.x,1.)*.03;
    split+=lens.yz*vec2(resolution.y/resolution.x,1.)*.006;
    vec4 red=texture(scene,base+split), green=texture(scene,base), blue=texture(scene,base-split);
    vec4 raw=vec4(red.r,green.g,blue.b,max(green.a,max(red.a,blue.a)));
    // The sky's overall opacity lives here, not in CSS, so the front copy
    // and the sky behind it always share one look.
    vec4 sky=raw*.85*(1.-lens.x);
    // Layer 1 is the copy passed in front of the page, at full strength like
    // the original cover. It follows the cloud's own density (thin haze is
    // never lifted) under a wide, soft reach, so the thickened cloud has no
    // geometric edge - an even copy inside a firm round mask read as a disc.
    float reach=1.-smoothstep(cover.z*.3,cover.z*1.4,distance(gl_FragCoord.xy,cover.xy));
    float lift=coverAmount*reach*smoothstep(.15,.7,raw.a)*(1.-lens.x*.85);
    if(layer==0 && gleam>0.) {
        // Resample at the same warped coordinate as the cloud. Cloud opacity
        // occludes the clear-space view per channel; its volume already
        // supplies the scattered view of this light.
        // The run-in is the one part with no cloud-scattered twin in the
        // scene, so cloud must not hide it: it shows through as the same
        // ray, at the same strength, as the one that leaves the cloud.
        float before;
        vec3 light=clearSpaceLight(beamBase,beamSplit,before);
        vec3 beam=light*mix(1.-vec3(red.a,green.a,blue.a),vec3(1.),before);
        // A fixed per-pixel offset breaks 8-bit steps in the dim falloff.
        float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
        beam=max(beam+grain/255.*smoothstep(0.,.004,max(beam.r,max(beam.g,beam.b))),0.);
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

/** A scattering-angle cosine no ray can have: the glare lobe never lights. */
const NO_GLARE = 9;

/** Screen x, in CSS pixels, midway between the card stack's resting right edge
 * and the viewport's. Without a usable margin (no stack, or cards spanning the
 * width) it falls back to four fifths across. */
function clearOfCards(cards: HTMLElement | null | undefined, width: number) {
    const edge=cards ? cards.getBoundingClientRect().right : 0;
    return edge>0 && edge<width*.97 ? Math.min(edge+(width-edge)*.5,width*.97) : width*.8;
}

/** The central ray as the camera sees it. Mirrors the shaders' camera: eye at
 * z=6, focal length 1.8. `alongAt` is the distance along the ray, from its
 * origin, at which it projects to `across` (a fraction of the viewport
 * width), searched between `near` and `far`. */
function centralRay(launch: ReturnType<typeof cloudPose>, rays: Float32Array, aspect: number) {
    const {rotation: r,size,worldX,worldY,depth}=launch;
    const toWorld=(x: number,y: number,z: number)=> {
        const sx=x*size,sy=y*size*.8,sz=z*size*.8;
        return [r[0]*sx+r[3]*sy+r[6]*sz,r[1]*sx+r[4]*sy+r[7]*sz,r[2]*sx+r[5]*sy+r[8]*sz];
    };
    const pointAt=(along: number)=> {
        const p=toWorld(rays[12]+rays[14]*along,rays[13]+rays[15]*along,.27);
        return [worldX+p[0],worldY+p[1],6-depth+p[2]];
    };
    const screenX=(p: number[])=>(p[0]*1.8/(6-p[2])/aspect+1)/2;
    // The ray runs left to right on screen, so a crossing can be bisected.
    const alongAt=(across: number,near: number,far: number)=> {
        for(let i=0;i<24;i++) {
            const middle=(near+far)/2;
            if(screenX(pointAt(middle))<across) near=middle; else far=middle;
        }
        return near;
    };
    return {toWorld,pointAt,alongAt,screenX};
}

/** Where the gleam begins on screen, as a fraction of the viewport width:
 * just past the left edge, behind the sidebar, so it grows in from there. */
const GLEAM_ENTRY = -.04;

/** How far back along the central ray, in cloud-local units, the light has to
 * start for it to enter at GLEAM_ENTRY. The prism and its spectral fan stay
 * exactly where they were traced: this length is added in front of them. */
function leadFromScreenEdge(launch: ReturnType<typeof cloudPose>, rays: Float32Array, aspect: number) {
    const {pointAt,screenX}=centralRay(launch,rays,aspect);
    // Walked, not bisected: a carrier cloud turned toward the camera sends the
    // ray's backward run toward the eye, where the projection stops being
    // monotonic. Stop at the edge, or while the ray is still well in front.
    let back=0;
    while(back>-6) {
        const point=pointAt(back);
        if(6-point[2]<2 || screenX(point)<=GLEAM_ENTRY) break;
        back-=.04;
    }
    return -back;
}

/** Cosine of the scattering angle (light heading against the line to the
 * camera) at the point where the central ray projects to `across`, a 0..1
 * fraction of the viewport width. */
function facingWhereRayCrosses(launch: ReturnType<typeof cloudPose>, rays: Float32Array, aspect: number, across: number) {
    const {toWorld,pointAt,alongAt}=centralRay(launch,rays,aspect);
    const near=alongAt(across,0,40);
    const point=pointAt(near),heading=toWorld(rays[14],rays[15],0);
    const toEye=[-point[0],-point[1],6-point[2]];
    const dot=heading[0]*toEye[0]+heading[1]*toEye[1]+heading[2]*toEye[2];
    return dot/(Math.hypot(...heading)*Math.hypot(...toEye));
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
    const opticalUniformNames=["gleamLead","gleam","gleamProgress","gleamHead","gleamOffset","gleamTail","gleamStretch","gleamFree","gleamTime","gleamPixel","gleamGlint","beamCenter","beamScale","beamRotation","spectralRays[0]"];
    const uniforms = Object.fromEntries(["resolution","center","scale","rotation","time","seed","strength","formation","steps","flash","flashAt","lenses[0]","lensErode[0]",...opticalUniformNames].map(n => [n,gl.getUniformLocation(program,n)]));
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
    const chromaticUniforms = Object.fromEntries(["scene","resolution","pointer","progress","cover","coverAmount","layer","lenses[0]","lensPower[0]","lensDim[0]",...opticalUniformNames].map(n => [n,gl.getUniformLocation(chromaticProgram,n)]));
    gl.useProgram(chromaticProgram);
    gl.uniform1i(chromaticUniforms.scene,1);
    // The clear-space haze reads the clouds' noise volume, already on unit 0.
    gl.uniform1i(gl.getUniformLocation(chromaticProgram,"noiseVolume"),0);
    gl.useProgram(program);
    // A faint split always drifts around the sky; mouse movement and scroll
    // speed each add a little more, and both ease back to the ambient level.
    const chroma={x:.5,y:.5,targetX:.5,targetY:.5,progress:0,mouse:0,scroll:0,time:0,moved:-Infinity};
    // Where the pointer rests, for the ROOS light: unlike the split's
    // direction it holds still with the mouse and never wanders on its own.
    let pointerAt: { x: number; y: number } | null=null;
    const pointerMove = (event: PointerEvent) => {
        if(event.pointerType==="touch") return;
        chroma.targetX=event.clientX/window.innerWidth;
        chroma.targetY=1-event.clientY/window.innerHeight;
        chroma.moved=performance.now();
        pointerAt={x:chroma.targetX,y:chroma.targetY};
    };
    const pointerGone = () => { pointerAt=null; };

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
    // The featured strip pins for many screens of scroll, and the weather
    // travels with scroll: at full pace a cloud that is overhead when the
    // chapter opens has crossed and dispersed long before the last project,
    // leaving the sky empty behind it. Inside the strip (calmFrom..calmTo, in
    // screens of scroll) the weather moves at a fraction of its pace, so that
    // cloud stays through all the projects. The stage is cleared again for
    // the arrow: the last CALM_TAIL screens of the pin run at full pace.
    const showcase=document.querySelector<HTMLElement>("#projects [data-hscroll]");
    const CALM_PACE=.3, CALM_TAIL=1.5;
    let calmFrom=Infinity, calmTo=Infinity;
    /** Scroll as the weather experiences it: continuous, slowed in the strip. */
    const weatherScroll=(at: number)=>
        at<=calmFrom ? at : calmFrom+(Math.min(at,calmTo)-calmFrom)*CALM_PACE+Math.max(0,at-calmTo);
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
    const projects=document.querySelector<HTMLElement>("#projects");
    // Lightning inside the cloud over the projects chapter. Seeded, like the
    // noise, so the storm repeats from visit to visit.
    const storm={next:0,start:-Infinity,lag:0,pulses:[] as {at: number; power: number}[],
        spots:[[0,0,0],[0,0,0]],seed:9157};
    const stormRandom=()=> { storm.seed=(Math.imul(storm.seed,1664525)+1013904223)|0; return (storm.seed>>>8)/16777216; };
    const journey=document.querySelector<HTMLElement>("#journey");
    // The MORE PROJECTS arrow wears the sky's chromatic split (global.css).
    const splitWearer=document.querySelector<HTMLElement>("#projects [data-hscroll-arrow]");
    const journeyCards=journey?.querySelector<HTMLElement>(".stack-area");
    const lensElements=Array.from(document.querySelectorAll<HTMLElement>("[data-lens]"));
    // Small text that sits over the sky with no clearing of its own
    // (data-sky-adapt) is told when a bright cloud is behind it, so it can
    // switch to dark ink instead of the cloud having to make way.
    const skyReaders=Array.from(document.querySelectorAll<HTMLElement>("[data-sky-adapt]"));
    const skySample=new Uint8Array(4*64);
    let skyTick=0;
    const lensRects=new Float32Array(16), lensPowers=new Float32Array(4);
    const lensDims=new Float32Array(4), lensErodes=new Float32Array(4);
    // Reduced motion freezes this canvas while the page still scrolls, so
    // light pinned to a scrolling element would be left behind: no burst.
    const roos=document.querySelector<HTMLElement>("[data-roos]");
    const heroScrub=document.querySelector<HTMLElement>("[data-hero-scrub]");
    const burst=roos && !reduced.matches ? createLightBurst(gl,link,roos) : null;
    let revealed=performance.now();
    let opticalProgress=0;
    // The launch frame is fixed, so this is a constant of the layout. It is
    // measured where that frame is built and used by the clock a frame later.
    let gleamLead=0;
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
        // Hand the arrow the very split the chromatic pass uses below (same
        // direction, strength and easing), so the pointer and scroll speed
        // move its fringe exactly as they move the clouds'. Only while the
        // arrow is on stage; y flips because CSS runs downward.
        const arrowLife=splitWearer ? parseFloat(splitWearer.style.getPropertyValue("--arrow-life")) : 0;
        if(splitWearer && arrowLife>0 && arrowLife<1) {
            const movementX=(chroma.x-.5)*width/height,movementY=chroma.y-.5;
            const reach=chroma.progress/Math.max(Math.hypot(movementX,movementY),.2);
            splitWearer.style.setProperty("--sky-split-x",(movementX*reach).toFixed(4));
            splitWearer.style.setProperty("--sky-split-y",(-movementY*reach).toFixed(4));
        }
        if(!motion && scroll===previousScroll && last!==0) return;
        // The ambient shimmer keeps mobile drawing, but between scroll changes
        // it only resamples the cached clouds instead of ray-marching again.
        const journeyTop=journey ? journey.getBoundingClientRect().top/height : Infinity;
        // The clock starts early by exactly the run-in's length, so the light
        // reaches the prism, and crosses the cloud, when it always did.
        const opticalTarget=motion ? Math.max(0,(1.4-journeyTop)/2.+gleamLead/GLEAM_PACE) : 0;
        const opticalMoving=Math.abs(opticalTarget-opticalProgress)>.0005;
        opticalProgress=last===0 || !motion ? opticalTarget
            : opticalProgress+(opticalTarget-opticalProgress)*(1-Math.exp(-step*10));
        const flight=gleamFlight(opticalProgress,gleamLead);
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
            if(showcase) {
                const box=showcase.getBoundingClientRect();
                calmFrom=scroll+box.top/height;
                calmTo=Math.max(calmFrom,calmFrom+box.height/height-1-CALM_TAIL);
            }
        }
        const opening=motion ? Math.min(1,scroll/1.15) : 1;
        // Only section entrances lift a cloud in front of the content; the
        // hero exit leaves ROOS inflating through the cloud on its own.
        const veil=entrance*.65;
        // The closing volume forms over the last screens and settles along
        // the top edge once the contact panel is revealed.
        const closing=motion ? clamp01((scroll-(pageEnd-1.3))/1.3) : 0;
        last=now; previousScroll=scroll;
        // Up to four lenses at once: the clearing opens as its text nears the
        // middle of the screen and closes again as it leaves.
        const pixel=canvas.width/width;
        lensPowers.fill(0);lensDims.fill(0);lensErodes.fill(0);
        let lensCount=0;
        for(const element of lensElements) {
            if(lensCount===4) break;
            const box=element.getBoundingClientRect();
            if(box.width===0 || box.bottom<0 || box.top>height || box.right<0 || box.left>width) continue;
            const middle=box.top+box.height/2, centre=box.left+box.width/2;
            // Measured from the screen's edges, not its middle: the lens is
            // exactly zero as its text crosses an edge, whatever the text's
            // size, and full once it is well inside. Nothing can switch.
            const inside=(far: number, half: number, size: number, ramp: number)=>
                smooth((size/2+half-far)/(size*ramp));
            const power=inside(Math.abs(middle-height/2),box.height/2,height,.4)
                *inside(Math.abs(centre-width/2),box.width/2,width,.25);
            if(power<=0) continue;
            lensRects.set([centre*pixel,canvas.height-middle*pixel,
                (box.width*.62+80)*pixel,(box.height*.7+80)*pixel],lensCount*4);
            // Soft lenses thin the cloud and so need only half the dimming.
            const soft=element.dataset.lens==="soft", strength=motion ? power : 1;
            lensDims[lensCount]=strength*(soft ? .5 : .9);
            lensErodes[lensCount]=soft ? strength : 0;
            lensPowers[lensCount++]=strength;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,sceneBuffer);
        gl.useProgram(program);
        gl.uniform4fv(uniforms["lenses[0]"],lensRects);
        gl.uniform1fv(uniforms["lensErode[0]"],lensErodes);
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
        const ordered=ambientPasses(weatherScroll(scroll));
        // Pick the existing front cloud halfway through the original birth
        // interval. The light owns this world frame for its entire flight;
        // crossing the cloud edge never changes its position or velocity.
        const launchScroll=Math.max(0,scroll+journeyTop-.6);
        const carrier=ambientPasses(weatherScroll(launchScroll)).sort((a,b)=>a.distance-b.distance)[0];
        const launch=carrier && cloudPose(carrier,desktop.matches,width/height,0);
        const beamPaths=carrier ? spectralPaths(carrier.progress) : new Float32Array(28);
        gleamLead=launch ? leadFromScreenEdge(launch,beamPaths,width/height) : 0;
        // The glare needs open sky: aim the haze's bright scattering angle at
        // the point where the ray clears the card stack, whatever the layout.
        // Handheld layouts have no such margin, so they get no glare at all.
        const glintFacing=launch && desktop.matches ? facingWhereRayCrosses(launch,beamPaths,
            width/height,clearOfCards(journeyCards,width)/width) : NO_GLARE;
        const uploadLight=(locations: Record<string,WebGLUniformLocation|null>)=> {
            gl.uniform1f(locations.gleam,opticalActive && launch ? 1 : 0);
            if(!launch) return;
            gl.uniform1f(locations.gleamLead,gleamLead);
            gl.uniform1f(locations.gleamProgress,flight.growth);
            gl.uniform1f(locations.gleamHead,flight.head);
            gl.uniform1f(locations.gleamOffset,flight.offset);
            gl.uniform1f(locations.gleamTail,flight.tail);
            gl.uniform1f(locations.gleamStretch,flight.stretch);
            gl.uniform1f(locations.gleamFree,flight.free);
            gl.uniform1f(locations.gleamTime,chroma.time);
            // Cloud-local size of one sky pixel at the launch depth.
            gl.uniform1f(locations.gleamPixel,launch.depth/(.9*canvas.height)/launch.size);
            gl.uniform1f(locations.gleamGlint,glintFacing);
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
        // The storm gathers as the projects chapter settles into place and
        // stays over the featured projects. Desktop only: phones redraw
        // their sky on scroll alone, so a flash there could never play out.
        const projectsTop=projects ? projects.getBoundingClientRect().top/height : Infinity;
        // The storm lasts as long as the calmed weather does: to the last project.
        const stormEnd=Number.isFinite(calmTo) ? calmTo : scroll+projectsTop+2;
        const stormGate=idleAnimate ? smooth((.5-projectsTop)/.5)*(1-smooth((scroll-(stormEnd-.8))/.8)) : 0;
        // The two nearest ambient clouds answer each other: the second
        // repeats the strike a moment after the first. A cloud still
        // condensing or already dispersing is left out, so the lead strike
        // never goes to one that cannot be seen yet.
        const stormClouds=stormGate>0 ? ordered
            .filter(p=>!p.hero && !p.finale && Math.min(p.progress/.2,(1-p.progress)/.18)>.3)
            .sort((a,b)=>a.distance-b.distance).slice(0,2) : [];
        if(stormClouds.length>0 && stormGate>.5 && now>=storm.next) {
            // A strike is a few quick flickers from one spot low in the cloud,
            // where the sun leaves it in shadow and a glow from within shows.
            storm.start=now;
            storm.next=now+3500+stormRandom()*5500;
            storm.lag=320+stormRandom()*260;
            storm.spots=storm.spots.map(()=>
                [-.55+stormRandom()*1.15,-.34+stormRandom()*.24,(stormRandom()-.5)*.4]);
            let at=0;
            storm.pulses=Array.from({length:2+Math.floor(stormRandom()*3)},()=> {
                const pulse={at,power:.45+stormRandom()*.55};
                at+=60+stormRandom()*110;
                return pulse;
            });
        }
        /** Light and tremble in a cloud `since` milliseconds after its strike
         * began. Nothing before the strike, including before the first one. */
        const strike=(since: number)=> {
            if(!(since>=0) || !Number.isFinite(since)) return {flash:0,rumble:0};
            // Each flicker snaps on and decays; low-key, so the sum stays well under 1.
            const flash=stormGate*.5*storm.pulses.reduce((sum,pulse)=> {
                const t=since-pulse.at;
                return t<0 ? sum : sum+pulse.power*smooth(t/30)*Math.exp(-t/110);
            },0);
            // The faintest tremble through the cloud afterwards: under a pixel.
            return {flash,rumble:stormGate*.012*Math.exp(-since/450)*Math.sin(since*.055)};
        };
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
            const pose=cloudPose(pass,desktop.matches,width/height,life);
            const {size,depth,rotation}=pose;
            const stormRank=stormClouds.indexOf(pass);
            const bolt=strike(stormRank<0 ? -1 : now-storm.start-stormRank*storm.lag);
            const worldX=pose.worldX+bolt.rumble;
            const worldY=pose.worldY+bolt.rumble*.6;
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
            gl.uniform1f(uniforms.flash,bolt.flash);
            // Lean the strike toward the side of this cloud that faces the
            // eye (the camera's axis in cloud-local terms), so the glow is
            // not buried behind the body of a cloud that is turned away.
            const spot=storm.spots[Math.max(0,stormRank)];
            gl.uniform3f(uniforms.flashAt,spot[0]+rotation[2]*.32,spot[1]+rotation[5]*.32,spot[2]+rotation[8]*.32);
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
        gl.uniform4fv(chromaticUniforms["lenses[0]"],lensRects);
        gl.uniform1fv(chromaticUniforms["lensPower[0]"],lensPowers);
        gl.uniform1fv(chromaticUniforms["lensDim[0]"],lensDims);
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
        if(burst && motion) {
            // The rays rise with the logo's entrance and leave with its
            // explosion (the same --scrub that inflates and fades ROOS).
            const scrub=parseFloat(heroScrub?.style.getPropertyValue("--scrub") ?? "") || 0;
            // The loading screen shows ROOS alone; the rays rise as it lifts.
            if(document.documentElement.classList.contains("is-loading")) revealed=now;
            const arrival=smooth((now-revealed-150)/1400);
            burst.draw(pointerAt,arrival*(1-scrub)**1.4,desktop.matches,step);
        }
        // Read the finished sky behind each adaptive element: one row of
        // pixels through its middle, every third frame. Desktop only; the
        // readback would cost a phone more than the effect is worth.
        if(desktop.matches && skyReaders.length>0 && ++skyTick%3===0) {
            for(const element of skyReaders) {
                const box=element.getBoundingClientRect();
                if(box.width===0 || box.bottom<0 || box.top>height) continue;
                const x=Math.floor(box.left*pixel);
                const y=Math.floor(canvas.height-(box.top+box.height/2)*pixel);
                const span=Math.max(1,Math.min(64,Math.floor(box.width*pixel)));
                if(x<0 || y<0 || x+span>canvas.width || y>=canvas.height) continue;
                gl.readPixels(x,y,span,1,gl.RGBA,gl.UNSIGNED_BYTE,skySample);
                let light=0;
                // Premultiplied over a black page: the channels are what shows.
                for(let i=0;i<span;i++) {
                    light+=.2126*skySample[i*4]+.7152*skySample[i*4+1]+.0722*skySample[i*4+2];
                }
                light/=span*255;
                // Two thresholds, so a cloud edge drifting across the text
                // cannot make it flicker between inks.
                const onCloud=element.classList.contains("on-cloud");
                element.classList.toggle("on-cloud",light>(onCloud ? .3 : .42));
            }
        }
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
    document.documentElement.addEventListener("pointerleave",pointerGone);
    document.addEventListener("visibilitychange",reset);
    reduced.addEventListener("change",reset);
    canvas.addEventListener("webglcontextlost",lost);
    return () => {
        disposed=true;cancelAnimationFrame(frame);
        window.removeEventListener("resize",resize);
        window.removeEventListener("pointermove",pointerMove);
        document.documentElement.removeEventListener("pointerleave",pointerGone);
        document.removeEventListener("visibilitychange",reset);
        reduced.removeEventListener("change",reset);canvas.removeEventListener("webglcontextlost",lost);
        // Lost-context resources are already invalid, including after restoration.
        if (!contextLost) {
            gl.deleteTexture(texture);gl.deleteBuffer(buffer);
            gl.deleteTexture(sceneTexture);gl.deleteFramebuffer(sceneBuffer);
            burst?.dispose();
            shaders.forEach(s=>gl.deleteShader(s));programs.forEach(p=>gl.deleteProgram(p));
        }
    };
}
