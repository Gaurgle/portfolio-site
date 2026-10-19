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
    // Inside a cloud the light behind the formed packet (the run-in and, once
    // released, the trail) is not part of the rigid body: keep it in reach.
    float back=dense ? min(body,run-gleamTail) : body;
    if(abs(p.z-.27)>.8 || abs(side)>.75 || back<-.2 || body>gleamHead+.7) return vec3(0.);
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
            // Forward scattering: a soft skirt, far wider than the beam.
            profile+=.05*grown*exp(-.5*across*across/.07);
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
    if(dense) {
        // The dispersed look starts at the prism. Before it the same light
        // is still one white, undispersed core: cloud drifting in front of
        // the prism scatters it like any other light instead of being
        // painted over by the clear-space ray. Lit from the tail to the
        // prism, brightening toward the head as the open-space ray does, so
        // the two looks meet at the same strength wherever the cloud ends.
        float trail=(run-gleamTail)*gleamStretch;
        float pre=(1.-smoothstep(gleamLead-.06,gleamLead+.02,run))
            *smoothstep(-.02,.055,trail)*(1.-smoothstep(gleamHead-.02,gleamHead+.07,run))
            *pow(clamp(trail/max(gleamHead,.001),0.,1.),2.6);
        float white=exp(-.5*side*side/.00004)+.11*exp(-.5*side*side/.012);
        // Entering: until the head reaches the prism it drives into the
        // cloud as a soft, warm bulb of scattered light that travels with
        // it, and the path behind it glows from within. The bulb's flanks
        // part faintly, warm to one side and cool to the other: the cloud
        // already bends the light a little before the prism splits it.
        // Scattered light fills a volume, not the thin sheet the core runs
        // in, so the bulb and the glow have depth of their own.
        float entering=1.-smoothstep(gleamLead-.15,gleamLead+.05,gleamHead);
        float front=exp(-pow((run-gleamHead)/.28,2.))*smoothstep(-.02,.055,trail);
        float bulb=front*exp(-.5*side*side/.015)*exp(-pow((p.z-.27)/.35,2.))*entering;
        vec3 flank=mix(vec3(1.),side>0. ? vec3(1.1,.95,.8) : vec3(.82,.95,1.12),smoothstep(.02,.12,abs(side)));
        // The path behind the head stays lit from within, brightest near it.
        float path=smoothstep(-.02,.055,trail)*(1.-smoothstep(gleamHead-.02,gleamHead+.07,run))
            *(1.-smoothstep(gleamLead-.06,gleamLead+.02,run))
            *(.35+.65*clamp(trail/max(gleamHead,.001),0.,1.));
        float glow=.35*exp(-.5*side*side/.004)*exp(-pow((p.z-.27)/.26,2.))*path*entering;
        return sum+vec3(1.)*white*pre*depth+vec3(1.,.82,.58)*flank*bulb*.32+vec3(1.,.9,.75)*glow;
    }
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
    // While the light is still entering its cloud (before the prism) its
    // glow is cloud lit from within, and behind settled text it is toned
    // down like any other cloud; the corridor opens as it reaches the prism.
    corridor*=smoothstep(gleamLead-.15,gleamLead+.05,gleamHead);
    return 1.-corridor;
}
`;

// Lenses: where loose text floats with no panel behind it (data-lens). One
// treatment for every text block on the page. Centre and half size in canvas
// pixels (the text's box plus a margin). lensPower bends the sky at the rim;
// lensDim is how far the text has settled (0..1), and with it how firmly the
// cloud behind it is held under a brightness ceiling (see the chromatic
// pass). Clouds still pass behind and overlap everything, which is where the
// page's depth comes from.
// A lens only ever acts on the finished sky (the chromatic pass). It must not
// reshape the cloud in the volume pass: carving density along the lens's
// near-straight sides cut clouds off in hard vertical edges. For the same
// reason the shape is an ellipse with a wide feather: a superellipse has flat
// sides, and on a tall text block its fade and its refracting rim become
// straight vertical seams in the cloud.
const lensShape = `
uniform vec4 lenses[4];
uniform float lensPower[4];
uniform float lensDim[4];
// 0 at a lens's centre, 1 on its outline.
float lensRadius(int k, vec2 at) {
    return length((at-lenses[k].xy)/lenses[k].zw);
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
                // Inside the cloud, past the prism, light only shows where
                // the cloud scatters it, and how depends on how thick the
                // cloud is there. A dense core scatters every wavelength
                // alike and burns near white and bright; thin cloud passes
                // only a faint glow that keeps its spectral split. Cloud
                // between this point and the source (blocked, above) shades
                // it. So along its path the light swells, breaks up, fades
                // and changes colour with the cloud's own density, slowly
                // and continuously as the cloud drifts across it. The entry
                // (before the prism) keeps its own look.
                float passage=smoothstep(gleamLead-.15,gleamLead+.05,gleamHead);
                float thick=smoothstep(.25,2.6,d);
                vec3 white=vec3(dot(beam,vec3(.3333)))*1.2;
                beam=mix(beam,mix(beam,white,thick*.35),passage);
                lighting+=beam*gleam*3.*mix(1.,mix(.7,1.9,thick),passage);
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
// 0..1: how far the night cap holds the hero fly-through down (see render).
uniform float nightCap;
// The sky's quiet hue for this stretch of the weather: a near-white multiplier
// (indigo, deep teal, a bruised violet), never a colour of its own.
uniform vec3 skyTint;
// Seconds of sky time: advances only while motion is allowed.
uniform float skyTime;
// The pointer as a soft light: xy in uv, z its eased strength (0 when off).
uniform vec3 pointerLight;
// How far the copy in front of the page leads the cloud while scrolling, uv.
uniform float frontLead;
${lensShape}
out vec4 color;
const float zoom=.2, displacement=.05, chromatic=.01;
// Behind settled text a cloud is toned down with this knee (luminance over
// black): the brightest glare lands near .3, the body of the cloud a little
// under it. White type keeps its own black halo (global.css), which carries
// the contrast right at the glyphs; the cloud only loses its glare.
const float TEXT_KNEE=.45;
// Thin-film colour: the slow interference sheen of an oil film, one cosine
// per channel, so it drifts through the spectrum without ever stepping.
vec3 film(float phase) {
    return .5+.5*cos(6.2832*(phase+vec3(0.,.33,.67)));
}
// x: how clear the sky is here (0..1). yz: refraction offset, in uv.
vec3 lensField(vec2 at) {
    float clear=0., weight=0.;
    vec2 bend=vec2(0.);
    for(int k=0;k<4;k++) {
        if(lensPower[k]<=0.) continue;
        float r=lensRadius(k,at);
        // Full over the text itself, feathered out past it.
        clear=max(clear,(1.-smoothstep(.7,1.25,r))*lensDim[k]);
        // Overlapping rims are blended, not summed: summed, neighbouring
        // lenses (a chapter mark beside two passages) stacked their warp and
        // chromatic split. Weighting each rim by its own strength keeps the
        // result no stronger than the strongest rim, and continuous where
        // one rim takes over from another (picking the strongest switched).
        float rim=smoothstep(.8,1.1,r)*(1.-smoothstep(1.1,1.45,r))*lensPower[k];
        bend+=normalize(at-lenses[k].xy+vec2(.0001))*rim*rim;
        weight+=rim;
    }
    return vec3(clear,bend/max(weight,.001));
}
// split is the sky's own chromatic offset, so the light takes the same red
// and blue fringing as the clouds around it. A ray this fine needs a wider
// split than a cloud for it to show, so the released light amplifies it.
vec3 clearSpaceLight(vec2 uv, vec2 split) {
    if(gleam<=0.) return vec3(0.);
    vec3 ro=beamLocal(vec3(0.,0.,6.));
    vec3 p=onLightPlane(uv,ro), warm=onLightPlane(uv+split,ro), cool=onLightPlane(uv-split,ro);
    // The run-in, before the prism, is already in open sky: it wears the
    // open-space look from the start, the same ray that leaves the cloud at
    // the other end (fine core, faint glow, the sky's split, the haze).
    float run=dot(p.xy-spectralRays[3].xy,normalize(spectralRays[3].zw))+gleamLead;
    // 1 on the run-in ahead of the prism, 0 from the prism on.
    float before=1.-smoothstep(gleamLead-.25,gleamLead+.05,run);
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
    float aspect=resolution.x/resolution.y;
    vec2 movement=(pointer-.5)*vec2(aspect,1.);
    vec2 direction=movement/max(length(movement),.2);
    vec2 base=mix(uv,vec2(.5),zoom*progress*.28);
    // Space has a little curvature: a slow, low-frequency field from the
    // clouds' own noise bends the sky by a few pixels, drifting over tens of
    // seconds. Below the threshold of motion, at the edge of noticing.
    vec3 q=vec3(uv*vec2(aspect,1.)*.55,skyTime*.0045);
    vec2 curve=vec2(texture(noiseVolume,q).r,texture(noiseVolume,q+.37).r)-.5;
    base+=curve*.007;
    // The copy in front of the page is nearer, so it leads the cloud a
    // little while the page moves and settles back onto it at rest.
    if(layer==1) base.y-=frontLead;
    float band=sin(uv.y*24.+pointer.x*5.);
    float fineBand=sin(uv.y*71.-pointer.y*4.);
    base.x+=(band*.72+fineBand*.28)*displacement*progress*.16;
    base.y+=direction.y*displacement*progress*.12;
    vec2 split=direction*chromatic*progress;
    split.x+=band*chromatic*progress*.35;
    // The separation breathes with the curvature instead of holding still.
    split*=1.+.3*sin(skyTime*.19+curve.x*4.);
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
    // Layer 1 is the copy passed in front of the page, at full strength like
    // the original cover. It follows the cloud's own density (thin haze is
    // never lifted) under a wide, soft reach, so the thickened cloud has no
    // geometric edge - an even copy inside a firm round mask read as a disc.
    // Settled text is never covered: the copy stands aside wherever a lens is.
    float reach=1.-smoothstep(cover.z*.3,cover.z*1.4,distance(gl_FragCoord.xy,cover.xy));
    float lift=coverAmount*reach*smoothstep(.15,.7,raw.a)*(1.-lens.x);
    vec3 beam=vec3(0.);
    float beamAlpha=0.;
    if(layer==0 && gleam>0.) {
        // Resample at the same warped coordinate as the cloud. Cloud opacity
        // occludes the clear-space view per channel, run-in included; the
        // volume already supplies the scattered view of this light.
        vec3 light=clearSpaceLight(beamBase,beamSplit);
        beam=light*(1.-vec3(red.a,green.a,blue.a));
        // A fixed per-pixel offset breaks 8-bit steps in the dim falloff.
        float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
        beam=max(beam+grain/255.*smoothstep(0.,.004,max(beam.r,max(beam.g,beam.b))),0.)*.85;
        beamAlpha=max(beam.r,max(beam.g,beam.b));
    }
    // Hue, sheen and pointer light, computed once from the cloud itself and
    // carried by both layers so the copy in front stays the same cloud.
    // Hue: the shadowed body takes the stretch's tint most, the lit tops
    // least, so the cloud reads as lit by something not quite white.
    float body=dot(raw.rgb,vec3(.2126,.7152,.0722))/max(raw.a,.001);
    vec3 tint=mix(vec3(1.),skyTint,.15+.6*(1.-smoothstep(.2,.75,body)));
    // A cloud's rim: where the volume thins out into open space.
    float rim=smoothstep(.03,.22,raw.a)*(1.-smoothstep(.3,.7,raw.a));
    // Thin-film sheen on the rim, shifting with where it sits on screen
    // (the view angle), the curvature and the scroll.
    vec3 sheen=film(dot(uv,vec2(.9,1.3))+curve.y*2.+progress*.6+skyTime*.012)*rim*.05;
    // The pointer: cloud near it brightens, its rim catches a spectral edge
    // that turns with the angle to the light. Not inside a lens: the light
    // never lifts the cloud back up behind text that is in place.
    vec2 toLight=(uv-pointerLight.xy)*vec2(aspect,1.);
    float glow=pointerLight.z*exp(-dot(toLight,toLight)/.05)*(1.-lens.x);
    vec3 lit=vec3(.92,.95,1.)*glow*raw.a*.2
        +film(atan(toLight.y,toLight.x)*.159+skyTime*.02)*glow*rim*.14;
    vec4 shaded=vec4(raw.rgb*tint+(sheen+lit)*raw.a,raw.a);
    // Text over the sky: the cloud behind a settled text block is toned
    // down with a soft knee instead of being blacked out or carved away.
    // Bright parts are pressed down hardest and dim parts least, so its
    // shapes, shadows and edges all stay; only its glare goes, and nothing
    // behind the text runs much above a third of white. The lens eases in
    // with the text settling, so nothing switches.
    vec3 cloud=shaded.rgb*.85;
    float glare=dot(cloud,vec3(.2126,.7152,.0722));
    cloud*=mix(1.,1./(1.+glare/TEXT_KNEE),lens.x);
    vec4 sky=vec4(cloud+beam,max(raw.a*.85,beamAlpha));
    // Deep space keeps a breath of the same hue: a faint, slow nebular
    // wash, three or four levels above black at most.
    float wash=texture(noiseVolume,vec3(uv*vec2(aspect,1.)*.3,skyTime*.003+.5)).r;
    sky.rgb+=(skyTint-.86)*.035*(.4+.6*wash)*(1.-sky.a);
    color=layer==1 ? shaded*lift : sky;
    // Night: no part of the frame may run brighter than a grey-blue 0.6, so
    // flying through the hero cloud is a dim fog, not a flash. min() scales
    // only what exceeds the cap, so nothing switches at the limit.
    float luma=dot(color.rgb,vec3(.2126,.7152,.0722));
    color.rgb=mix(color.rgb,color.rgb*min(1.,.6/max(luma,1e-4))*vec3(.84,.91,1.),nightCap);
}
`;

type Cloud = { phase: number; size: number };
type CloudPass = {
    c: Cloud; i: number; cycle: number; progress: number; hero: boolean;
    finale: boolean; distance: number;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** World units an ambient cloud rises over one pass (see cloudPose). */
const CLOUD_RISE = 1.6;
/** The sky's hue per stretch of the weather, as near-white multipliers:
 *  indigo, deep teal, bruised violet, a cold blue-grey. Low saturation on
 *  purpose: we are in space, and the hue is felt more than seen. */
const SKY_TINTS = [[.88,.9,1.12],[.86,1.03,1.05],[1.04,.88,1.08],[.92,.95,1.06]];
/** Screens of weather per hue: it changes across stretches of the journey,
 *  never in step with the chapters. */
const TINT_SPAN = 4.5;
const skyTintAt = (weather: number) => {
    const t = weather/TINT_SPAN, i = Math.floor(t), f = t-i;
    const a = SKY_TINTS[((i%4)+4)%4], b = SKY_TINTS[(((i+1)%4)+4)%4];
    // Eased between the two, so the hue never turns at a corner.
    const e = f*f*(3-2*f);
    return a.map((v,k)=>v+(b[k]-v)*e);
};
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
        : finale ? (desktop
            // Desktop: born far behind the projects listing and held there while
            // the rows are read (the first 60%), then carried up and in to rest
            // along the top edge of the contact panel as the page lifts away.
            ? [-2.3+3.5*smooth((progress-.6)/.4),.7+3*smooth((progress-.6)/.4)]
            : [.8+progress*.4,4.6-progress*.9])
        : desktop ? paths[(cycle+i)%paths.length]
        : [-1.35+progress*3.6,-1.35];
    const worldX=path[0]+.25*variation+.14*Math.sin(life*.045+phase);
    // Parallax: an ambient cloud rises through the frame over its life, as
    // anything between the stars and the page would while the page scrolls
    // up. Centred on mid-life, so where it meets its chapter is unchanged;
    // a fixed world offset reads faster on screen the nearer the cloud is.
    const rise=hero || finale ? 0 : (progress-.5)*CLOUD_RISE;
    const worldY=path[1]+rise+.4*Math.sin(progress*Math.PI+phase)+.12*Math.sin(life*.06+phase);
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

/** Scroll, in screens, by which the hero and its opening cloud are gone;
 *  the gleam's run-in never begins before it. */
const HERO_CLEAR = 1.3;

/** Screens of scroll the light takes from the left edge to the prism. */
const RUN_IN = .35;
/** Screens over which the flight makes up a run-in that started late. */
const CATCH_UP = 1.85;

/** Run-in progress at t (0..1 of the run-in) for a run-in `length` long: the
 * light crosses open sky fast, brakes as it enters the cloud, and meets the
 * prism at `exit` (the flight's own pace, in progress per unit t), so the
 * hand-over into the flight has no seam. A cubic with those three ends. */
function runIn(t: number, length: number, exit: number) {
    const pace=Math.min(exit,length);
    return 1.5*length*t-pace*t*t+(pace-.5*length)*t*t*t;
}

/** Reduced motion: one still frame with the light already inside its cloud,
 * just past the prism, the spectrum beginning to open. */
const frozenGleam = (runInLength: number) => runInLength+.12;

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
    const uniforms = Object.fromEntries(["resolution","center","scale","rotation","time","seed","strength","formation","steps","flash","flashAt",...opticalUniformNames].map(n => [n,gl.getUniformLocation(program,n)]));
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
    const chromaticUniforms = Object.fromEntries(["scene","resolution","pointer","progress","cover","coverAmount","layer","nightCap","skyTint","skyTime","pointerLight","frontLead","lenses[0]","lensPower[0]","lensDim[0]",...opticalUniformNames].map(n => [n,gl.getUniformLocation(chromaticProgram,n)]));
    gl.useProgram(chromaticProgram);
    gl.uniform1i(chromaticUniforms.scene,1);
    // The clear-space haze reads the clouds' noise volume, already on unit 0.
    gl.uniform1i(gl.getUniformLocation(chromaticProgram,"noiseVolume"),0);
    gl.useProgram(program);
    // A faint split always drifts around the sky; mouse movement and scroll
    // speed each add a little more, and both ease back to the ambient level.
    const chroma={x:.5,y:.5,targetX:.5,targetY:.5,progress:0,mouse:0,scroll:0,time:0,moved:-Infinity};
    // The pointer's light (eased strength) and how far the front copy leads,
    // signed with the scroll direction (eased).
    const sky={light:0,lead:0};
    // The starfield is DOM; it hears the sky's curvature and hue through
    // custom properties on its container (only written when they change).
    const starfield=document.querySelector<HTMLElement>(".particle-layers");
    let starfieldKey="";
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
    // the listing: over the last calmTail screens of the pin (the settle
    // beat and the pile's exit) the weather catches up, so that the whole
    // pin spends PIN_WEATHER screens of weather. That is what the clouds
    // after the strip (listing, contact) were composed against, whatever
    // the strip's own length.
    const showcase=document.querySelector<HTMLElement>("#projects [data-hscroll]");
    const CALM_PACE=.3, PIN_WEATHER=3.1;
    let calmFrom=Infinity, calmTo=Infinity, calmTail=1.5, tailPace=1;
    // The weather, and the cloud the journey's light is launched from, were
    // composed against the page with the hero pinned for half a screen. The
    // hero now holds longer for its curtain; the weather waits out the extra
    // hold, so every cloud still meets the content it was placed for.
    const WEATHER_HERO_PIN=.5;
    const heroPin=parseFloat(document.querySelector<HTMLElement>("#home")?.dataset.pin ?? "");
    const heroHold=Number.isFinite(heroPin) ? Math.max(0,heroPin-WEATHER_HERO_PIN) : 0;
    // The weather after the journey was composed against five journey
    // stops. With fewer, the journey's pin is shorter, and everything after
    // it would meet the weather early. The missing stops' worth of weather
    // is made up while the journey's stops are on stage (stopsFrom..stopsTo,
    // in screens of scroll), after the light's passage through its cloud at
    // the journey's top, so that passage and everything downstream meet the
    // clouds they were composed with.
    const journeyStack=document.querySelector<HTMLElement>("#journey [data-cardstack]");
    const journeyStops=journeyStack?.querySelectorAll("[data-stack-card]").length ?? 0;
    const COMPOSED_STOPS=5;
    let stopsFrom=Infinity, stopsTo=Infinity, stopsExtra=0;
    const journeyCatchUp=(at: number)=>stopsExtra*clamp01((at-stopsFrom)/Math.max(stopsTo-stopsFrom,1e-3));
    /** Scroll as the weather experiences it: continuous, made up over the
     *  journey's stops, slowed in the strip, hurried over its tail, and
     *  started once the hero has let go of the page. */
    const weatherScroll=(at: number)=>Math.max(0,
        (at<=calmFrom ? at : calmFrom+(Math.min(at,calmTo)-calmFrom)*CALM_PACE
            +Math.min(Math.max(0,at-calmTo),calmTail)*tailPace+Math.max(0,at-calmTo-calmTail))
        +journeyCatchUp(at)-heroHold);
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
    let previousScroll=-1, previousPageScroll=-1;
    // Night (before 08:00 or from 21:00, the visitor's own clock) caps the
    // hero fly-through's brightness. Read once, so it never changes mid-visit.
    const hour=new Date().getHours();
    const night=hour<8 || hour>=21;
    const projects=document.querySelector<HTMLElement>("#projects");
    const listingEl=document.querySelector<HTMLElement>(".more-projects-stage");
    // Lightning inside the cloud over the projects chapter. Seeded, like the
    // noise, so the storm repeats from visit to visit.
    const storm={next:0,start:-Infinity,lag:0,pulses:[] as {at: number; power: number}[],
        spots:[[0,0,0],[0,0,0]],seed:9157};
    const stormRandom=()=> { storm.seed=(Math.imul(storm.seed,1664525)+1013904223)|0; return (storm.seed>>>8)/16777216; };
    const journey=document.querySelector<HTMLElement>("#journey");
    const journeyCards=journey?.querySelector<HTMLElement>(".stack-area");
    const lensElements=Array.from(document.querySelectorAll<HTMLElement>("[data-lens]"));
    const contactPanel=document.querySelector<HTMLElement>(".contact-panel");
    // Small text that sits over the sky with no clearing of its own
    // (data-sky-adapt) is told when a bright cloud is behind it, so it can
    // switch to dark ink instead of the cloud having to make way.
    const skyReaders=Array.from(document.querySelectorAll<HTMLElement>("[data-sky-adapt]"));
    // Up to 64 pixels per reader, read into a pixel buffer and collected a
    // frame or so later behind a fence, so the page never waits on the GPU.
    const SKY_SPAN=64;
    const skySample=new Uint8Array(4*SKY_SPAN*skyReaders.length);
    const skyBuffer=gl.createBuffer();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,skyBuffer);
    gl.bufferData(gl.PIXEL_PACK_BUFFER,skySample.byteLength,gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    const skyPending: {element: HTMLElement; span: number; offset: number}[]=[];
    let skyFence: WebGLSync | null=null;
    let skyTick=0;
    const lensRects=new Float32Array(16), lensPowers=new Float32Array(4);
    const lensDims=new Float32Array(4);
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
    // The lead the light's clock last ran on. Reduced motion draws only on
    // change, so a lead measured after its first frame must still redraw.
    let leadInUse=0;
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
        // Signed: positive while the page scrolls down.
        const scrollVelocity=last!==0 && previousScroll>=0 ? (scroll-previousScroll)/Math.max(step,1/60) : 0;
        sky.lead+=(Math.max(-1,Math.min(1,scrollVelocity/1.5))-sky.lead)*(1-Math.exp(-step*4));
        // The pointer lights the sky softly while it is on the page and a
        // little more while it moves; fine pointers only, and never under
        // reduced motion.
        const lightTarget=desktop.matches && motion && pointerAt ? .35+.65*chroma.mouse : 0;
        sky.light+=(lightTarget-sky.light)*(1-Math.exp(-step*(lightTarget>sky.light ? 5 : 1.5)));
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
        // Reduced motion freezes the weather, but the lenses still follow
        // their text down the page: only a page scroll redraws (the frozen
        // clouds are resampled, not ray-marched again).
        const pageScroll=window.scrollY;
        if(!motion && scroll===previousScroll && pageScroll===previousPageScroll
            && gleamLead===leadInUse && last!==0) return;
        previousPageScroll=pageScroll;
        // The ambient shimmer keeps mobile drawing, but between scroll changes
        // it only resamples the cached clouds instead of ray-marching again.
        const journeyTop=journey ? journey.getBoundingClientRect().top/height : Infinity;
        // The flight was composed with the head reaching the prism as the
        // journey's top passes 1.4 screens (composedPrism). The light enters
        // a cloud that is already there: the run-in waits until the ambient
        // weather has fully formed (the ramp in the volume loop below), then
        // crosses from the left edge in RUN_IN screens, braking as it enters
        // the cloud. Where that pushes the prism past its composed moment,
        // the flight makes the lag up over CATCH_UP screens, so the journey
        // downstream sees the light where it was composed.
        const composedPrism=Math.max(0,scroll+journeyTop-.6)+.6-1.4;
        const cloudReady=heroHold+(desktop.matches ? .85 : 1.1)+.5;
        const runInStart=Math.max(cloudReady+.05,HERO_CLEAR);
        const prismAt=Math.max(composedPrism,runInStart+RUN_IN);
        // The light's world frame is the carrier cloud's pose in the middle
        // of the light's passage through it (the journey's top 0.6 screens
        // up). The light is fixed in the world while the cloud drifts on, so
        // posing it at the prism moment instead left the passage running
        // beside the cloud rather than through it. A fixed scroll position,
        // so the frame and the clock cannot drift apart between reloads,
        // fast scrolling or resizing. Reduced motion launches from the frozen
        // frame itself (weather 0), so its still light sits in a cloud that
        // is on screen.
        const launchScroll=motion ? composedPrism+.8 : 0;
        const lag=prismAt-composedPrism;
        const runInLength=gleamLead/GLEAM_PACE;
        leadInUse=gleamLead;
        const opticalTarget=!motion ? frozenGleam(runInLength) : scroll<prismAt
            ? runIn(clamp01((scroll-runInStart)/(prismAt-runInStart)),runInLength,(prismAt-runInStart)/2)
            : runInLength+(scroll-composedPrism)/2-lag/2*(1-smooth((scroll-prismAt)/CATCH_UP));
        const opticalMoving=Math.abs(opticalTarget-opticalProgress)>.0005;
        opticalProgress=last===0 || !motion ? opticalTarget
            : opticalProgress+(opticalTarget-opticalProgress)*(1-Math.exp(-step*10));
        const flight=gleamFlight(opticalProgress,gleamLead);
        const opticalActive=opticalProgress>.02;
        const sceneDirty=idleAnimate || opticalMoving || scroll!==previousScroll || last===0;
        if(idleAnimate) elapsed+=step;
        const life=idleAnimate ? elapsed : 0;
        if(scroll!==previousScroll || last===0) {
            entrance=idleAnimate ? Math.max(0,...sections.map(section=> {
                const top=section.getBoundingClientRect().top/height;
                return top>.15 && top<.9 ? Math.sin((top-.15)/.75*Math.PI)**2 : 0;
            })) : 0;
            pageEnd=(document.documentElement.scrollHeight-window.innerHeight)/height;
            if(journeyStack && journeyStops>0) {
                // Stops are ~0.65 screens each on desktop, 0.6 on phones
                // (smoothScroll.ts measureCardStacks).
                const box=journeyStack.getBoundingClientRect();
                stopsFrom=scroll+box.top/height+.45;
                stopsTo=Math.max(stopsFrom,scroll+box.bottom/height-1);
                stopsExtra=Math.max(0,COMPOSED_STOPS-journeyStops)*(desktop.matches ? .65 : .6);
            }
            if(showcase) {
                const box=showcase.getBoundingClientRect();
                calmFrom=scroll+box.top/height;
                // Phones keep their deck's own weather: a full-pace tail of
                // 1.5 screens, as composed.
                calmTail=desktop.matches ? .8 : 1.5;
                calmTo=Math.max(calmFrom,calmFrom+box.height/height-1-calmTail);
                tailPace=desktop.matches
                    ? Math.max(1,(PIN_WEATHER-(calmTo-calmFrom)*CALM_PACE)/calmTail) : 1;
            }
        }
        const opening=motion ? Math.min(1,scroll/1.15) : 1;
        // Section entrances lift a cloud in front of the content. The hero
        // exit leaves ROOS inflating through the cloud on its own, then, as
        // ROOS fades out (about half a screen in), the hero cloud itself is
        // lifted in front of the page: a curtain the first chapter is found
        // behind as it disperses, rather than laid over it.
        const veil=entrance*.65;
        const curtain=motion && opening<1 ? smooth((opening-.45)/.15) : 0;
        // The closing volume forms over the last screens and settles along
        // the top edge once the contact panel is revealed.
        const closing=motion ? clamp01((scroll-(pageEnd-1.3))/1.3) : 0;
        last=now; previousScroll=scroll;
        // Up to four lenses at once: the clearing opens as its text nears the
        // middle of the screen and closes again as it leaves.
        const pixel=canvas.width/width;
        lensPowers.fill(0);lensDims.fill(0);
        // The contact panel is fixed under the page, so its box is always on
        // screen: its lenses open only as the page lifts off it.
        const panelReveal=contactPanel
            ? clamp01((window.scrollY-(document.documentElement.scrollHeight-window.innerHeight-contactPanel.offsetHeight))
                /Math.max(1,contactPanel.offsetHeight)) : 0;
        let lensCount=0;
        for(const element of lensElements) {
            if(lensCount===4) break;
            const inPanel=contactPanel?.contains(element) ?? false;
            if(inPanel && panelReveal<=0) continue;
            const box=element.getBoundingClientRect();
            if(box.width===0 || box.bottom<0 || box.top>height || box.right<0 || box.left>width) continue;
            const middle=box.top+box.height/2, centre=box.left+box.width/2;
            // The lens covers only what of the block is on screen, so a tall
            // block (a whole column of copy under reduced motion) still gets
            // a lens of screen size, centred where its text actually is.
            const top=Math.max(0,box.top), bottom=Math.min(height,box.bottom);
            const left=Math.max(0,box.left), right=Math.min(width,box.right);
            // Measured from the screen's edges, not its middle: the lens is
            // exactly zero as its text crosses an edge, whatever the text's
            // size, and full once it is well inside. Nothing can switch.
            const inside=(far: number, half: number, size: number, ramp: number)=>
                smooth((size/2+half-far)/(size*ramp));
            // Under reduced motion nothing is in transit: whatever of a block
            // is on screen is in place, so the visible part sets the power.
            const rampMiddle=motion ? middle : (top+bottom)/2, rampHalf=motion ? box.height/2 : (bottom-top)/2;
            const power=inside(Math.abs(rampMiddle-height/2),rampHalf,height,.4)
                *inside(Math.abs(centre-width/2),box.width/2,width,.25)*(inPanel ? smooth(panelReveal) : 1);
            if(power<=0) continue;
            // An ellipse just reaching past the corners of the visible block.
            lensRects.set([(left+right)/2*pixel,canvas.height-(top+bottom)/2*pixel,
                ((right-left)*.6+70)*pixel,((bottom-top)*.6+70)*pixel],lensCount*4);
            // Power reaches 1 only once the text is well inside the screen, so
            // the ceiling settles in with the text and text in transit still
            // passes behind the weather. Every text block gets the same.
            lensDims[lensCount]=power;
            lensPowers[lensCount++]=power;
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER,sceneBuffer);
        gl.useProgram(program);
        gl.enable(gl.BLEND);
        gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);
        gl.uniform1i(uniforms.steps,desktop.matches?64:32);
        const active=desktop.matches?clouds:[clouds[0]];
        // Back-to-front ordering changes as volumes pass and recycle.
        // Screens of scroll per pass, per volume. Tuned to the page length: on
        // desktop the near volume must be condensing as the projects chapter
        // opens (about 7.5 screens in), so the storm has a cloud to live in.
        // Phones keep their own pace; their page runs shorter and lighter.
        const cycles=desktop.matches ? [7,8.6] : [9,11];
        const ambientPasses=(atScroll: number): CloudPass[]=>active.map((c,i)=> {
            const travel=atScroll/cycles[i]+c.phase;
            const progress=(travel%1)/.72;
            return {c,i,cycle:Math.floor(travel),progress,hero:false,finale:false,
                distance:[17,26][i]-[13,17][i]*progress};
        }).filter(c=>c.progress<1);
        const ordered=ambientPasses(weatherScroll(scroll));
        // Pick the existing front cloud halfway through the original birth
        // interval. The light owns this world frame for its entire flight;
        // crossing the cloud edge never changes its position or velocity.
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
            // through it before dispersing to expose the page. On desktop the
            // rush front-loads (1-(1-o)^1.6): the camera reaches the cloud about
            // 0.75 screens in and spends the rest travelling through it, inside
            // the fog, instead of crossing it in a few frames.
            const approach=desktop.matches ? 1-(1-opening)**1.6 : opening**1.3;
            ordered.push({c:{phase:0,size:3.6},i:3,cycle:0,progress:opening,
                hero:true,finale:false,distance:9.5-8.5*approach});
        }
        // The closing volume. On desktop it is one cloud from the projects
        // listing to the contact panel: it condenses far behind the listing (a
        // cloud for the glass rows to frost against), holds there while the
        // rows are read, then drifts up and in over the last screens to settle
        // along the top edge of the panel. Phones have no listing rows, so
        // there it forms over the last screens alone. `closing` stays the
        // short final ramp the ambient weather dissolves against.
        const finaleFrom=idleAnimate && listingEl
            ? Math.min(scroll+listingEl.getBoundingClientRect().top/height-1.3,pageEnd-1.3)
            : pageEnd-1.3;
        const finaleProgress=motion ? clamp01((scroll-finaleFrom)/Math.max(pageEnd-finaleFrom,1e-3)) : 0;
        if(finaleProgress>0) {
            ordered.push({c:{phase:0,size:3.4},i:4,cycle:0,progress:finaleProgress,
                hero:false,finale:true,
                distance:desktop.matches ? 16-8.5*finaleProgress**1.2 : 19-11.5*finaleProgress**1.2});
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
                ? smooth((scroll-heroHold-(desktop.matches?.85:1.1))/.5)*(1-smooth(closing))
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
            // The fog only shows while formation is above about .55 (seen from
            // inside), so an eased ramp to 0 crosses that band in a few frames
            // and the curtain seemed to vanish. It thins linearly into the
            // band instead, as the camera comes out the far side: the last
            // quarter screen of the pass is spent evaporating.
            const formation=hero && desktop.matches
                ? .52+.48*clamp01((1-progress)/.44)
                : growth*growth*(3-2*growth);
            gl.uniform1f(uniforms.formation,formation);
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
        cover.amount+=(proximity*Math.max(smooth(veil/.3),curtain)-cover.amount)*ease;
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
            Math.max(1,cover.radius*Math.sqrt(Math.max(veil,curtain,.05))));
        gl.uniform1f(chromaticUniforms.coverAmount,cover.amount);
        const tint=skyTintAt(weatherScroll(scroll));
        gl.uniform3f(chromaticUniforms.skyTint,tint[0],tint[1],tint[2]);
        gl.uniform1f(chromaticUniforms.skyTime,chroma.time);
        gl.uniform3f(chromaticUniforms.pointerLight,pointerAt?.x ?? .5,pointerAt?.y ?? .5,sky.light);
        gl.uniform1f(chromaticUniforms.frontLead,motion ? sky.lead*.012 : 0);
        if(starfield) {
            // The same slow curvature the sky is bent by, at the screen's
            // centre, in px (a pixel or two), plus the hue as an rgb colour.
            const bendX=(Math.sin(chroma.time*.031)+Math.sin(chroma.time*.017+1.3))*.9;
            const bendY=(Math.sin(chroma.time*.023+.7)+Math.sin(chroma.time*.013+2.1))*.9;
            const key=`${bendX.toFixed(2)} ${bendY.toFixed(2)} ${tint.map(v=>v.toFixed(3)).join(" ")}`;
            if(key!==starfieldKey) {
                starfieldKey=key;
                starfield.style.setProperty("--sky-bend-x",`${bendX.toFixed(2)}px`);
                starfield.style.setProperty("--sky-bend-y",`${bendY.toFixed(2)}px`);
                starfield.style.setProperty("--sky-hue",`rgb(${tint.map(v=>Math.round(Math.min(1,v/1.12)*255)).join(" ")})`);
            }
        }
        // Eased in with the curtain and out as the camera leaves the cloud.
        gl.uniform1f(chromaticUniforms.nightCap,night ? curtain*(1-smooth((opening-.9)/.1)) : 0);
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
        if(skyFence) {
            const status=gl.clientWaitSync(skyFence,0,0);
            if(status===gl.ALREADY_SIGNALED || status===gl.CONDITION_SATISFIED) {
                gl.deleteSync(skyFence);
                skyFence=null;
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER,skyBuffer);
                gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,skySample);
                gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
                for(const {element,span,offset} of skyPending) {
                    let light=0;
                    // Premultiplied over a black page: the channels are what shows.
                    for(let i=offset;i<offset+span*4;i+=4) {
                        light+=.2126*skySample[i]+.7152*skySample[i+1]+.0722*skySample[i+2];
                    }
                    light/=span*255;
                    // Two thresholds, so a cloud edge drifting across the text
                    // cannot make it flicker between inks.
                    const onCloud=element.classList.contains("on-cloud");
                    element.classList.toggle("on-cloud",light>(onCloud ? .3 : .42));
                }
                skyPending.length=0;
            }
        } else if(desktop.matches && skyReaders.length>0 && ++skyTick%3===0) {
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER,skyBuffer);
            skyReaders.forEach((element,index)=>{
                const box=element.getBoundingClientRect();
                if(box.width===0 || box.bottom<0 || box.top>height) return;
                const x=Math.floor(box.left*pixel);
                const y=Math.floor(canvas.height-(box.top+box.height/2)*pixel);
                const span=Math.max(1,Math.min(SKY_SPAN,Math.floor(box.width*pixel)));
                if(x<0 || y<0 || x+span>canvas.width || y>=canvas.height) return;
                const offset=index*4*SKY_SPAN;
                gl.readPixels(x,y,span,1,gl.RGBA,gl.UNSIGNED_BYTE,offset);
                skyPending.push({element,span,offset});
            });
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
            if(skyPending.length>0) skyFence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
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
            gl.deleteBuffer(skyBuffer);if(skyFence) gl.deleteSync(skyFence);
            burst?.dispose();
            shaders.forEach(s=>gl.deleteShader(s));programs.forEach(p=>gl.deleteProgram(p));
        }
    };
}
