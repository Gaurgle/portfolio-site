import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gleamFlight, refractRay, spectralPaths, tracePrism } from "./prismOptics.ts";

test("one head travels at the same speed before, across and after cloud exit", () => {
    const position=(p: number)=> { const f=gleamFlight(p); return f.head+f.offset; };
    const expected=1.47/.66;
    for(const p of [.08,.3,.69999,.7,.9,1.2,2,5,12]) {
        const speed=(position(p+.0001)-position(p))/.0001;
        assert.ok(Math.abs(speed-expected)<1e-8, `velocity changed at ${p}`);
    }
});

test("the formed prism packet translates intact, without a new growth or fade phase", () => {
    for(const p of [.7,.8,1,2,4,10]) {
        const f=gleamFlight(p);
        assert.ok(Math.abs(f.head-1.35)<1e-10);
        assert.ok(Math.abs(f.growth-1)<1e-10);
        assert.ok(f.offset>=0);
    }
    assert.ok(gleamFlight(2).offset>gleamFlight(1).offset);
});

test("the light forming inside the cloud is never reshaped by the open-space trail", () => {
    for(const p of [0,.04,.2,.5,.69,.7]) {
        const f=gleamFlight(p);
        assert.equal(f.tail,0);
        assert.equal(f.stretch,1);
        assert.equal(f.free,0);
    }
});

test("released, the tail falls behind at a steady pace so the ray only lengthens", () => {
    const length=(p: number)=> { const f=gleamFlight(p); return f.head+f.offset-f.tail; };
    const headSpeed=1.47/.66;
    let previous=length(.7);
    for(const p of [.71,.9,1.2,2,5,12]) {
        const f=gleamFlight(p);
        const tailSpeed=(gleamFlight(p+.0001).tail-f.tail)/.0001;
        assert.ok(tailSpeed>0 && tailSpeed<headSpeed*.5, `tail pace at ${p}`);
        assert.ok(Math.abs(tailSpeed-(gleamFlight(.8001).tail-gleamFlight(.8).tail)/.0001)<1e-6);
        assert.ok(length(p)>previous, `ray shortened at ${p}`);
        previous=length(p);
        // stretch maps the drawn-out ray back onto the formed footprint.
        assert.ok(Math.abs(length(p)*f.stretch-1.35)<1e-10);
    }
});

test("release eases in without a step and completes before the head clears the cloud", () => {
    const before=gleamFlight(.7), after=gleamFlight(.7001);
    assert.ok(after.free<1e-4 && after.tail<1e-3 && Math.abs(after.stretch-before.stretch)<1e-3);
    let previous=0;
    for(let p=.7;p<=1.2;p+=.005) {
        const free=gleamFlight(p).free;
        // Smoothstep peaks at 1.5x its mean slope: .084 per sample here.
        assert.ok(free>=previous && free<=1 && free-previous<.1, `release jumped at ${p}`);
        previous=free;
    }
    assert.equal(gleamFlight(.8).free,1);
});

test("flight is reversible, reload-safe and independent of captured exit state", () => {
    const expected=gleamFlight(.5);
    for(const p of [8,1,.1,3,0]) gleamFlight(p);
    assert.deepEqual(gleamFlight(.5),expected);
    assert.deepEqual(gleamFlight(-1),gleamFlight(0));
    for(const p of [0,.01,.5,.7,1,4,12]) {
        assert.ok(Object.values(gleamFlight(p)).every(Number.isFinite));
    }
});

test("cloud and clear-space materials share the exact optical field and uniforms", () => {
    const shader=readFileSync(new URL("./clouds.ts",import.meta.url),"utf8");
    assert.equal(shader.match(/vec3 opticalLight\(/g)?.length,1);
    assert.equal(shader.match(/\$\{opticalField\}/g)?.length,2);
    assert.match(shader,/uploadLight\(uniforms\)/);
    assert.match(shader,/uploadLight\(chromaticUniforms\)/);
    assert.doesNotMatch(shader,/continuedLight|continuationProgress|continuationRays|whiteCore/);
});

test("every visible wavelength exits across the full scroll range", () => {
    for(let p=0;p<=100;p++) for(let k=0;k<7;k++) {
        const ray=tracePrism(p/100,.43+k*.04);
        assert.ok(ray, `missing wavelength ${k} at ${p}%`);
        assert.ok(Math.abs(Math.hypot(...ray.direction)-1)<1e-10);
        assert.ok(ray.exit[0]>ray.entry[0]);
        // Exit must lie on the rotated triangle's right face, not an invented
        // fixed origin. Undo the geometry's rotation and test the face equation.
        const angle=-.23+p/100*.14;
        const x=ray.exit[0]*Math.cos(angle)+ray.exit[1]*Math.sin(angle);
        const y=-ray.exit[0]*Math.sin(angle)+ray.exit[1]*Math.cos(angle);
        assert.ok(Math.abs(y-(.076-x*.121/.07))<1e-9);
    }
});

test("blue bends more strongly and glass rotation changes the exit direction", () => {
    const blue=tracePrism(.5,.43)!,red=tracePrism(.5,.67)!;
    assert.ok(blue.n>red.n);
    assert.ok(Math.atan2(blue.direction[1],blue.direction[0])<Math.atan2(red.direction[1],red.direction[0]));
    assert.ok(Math.abs(tracePrism(0,.55)!.direction[1]-tracePrism(1,.55)!.direction[1])>.02);
});

test("uniforms remain finite and scrubbing is deterministic", () => {
    const a=spectralPaths(.37);
    spectralPaths(.95);
    assert.deepEqual(a,spectralPaths(.37));
    assert.equal(a.length,28);
    assert.ok([...a].every(Number.isFinite));
    assert.deepEqual(spectralPaths(-1),spectralPaths(0));
    assert.deepEqual(spectralPaths(2),spectralPaths(1));
});

test("Snell refraction preserves normal incidence and handles total reflection", () => {
    const normal=refractRay([1,0],[-1,0],1/1.5)!;
    assert.ok(Math.abs(normal[0]-1)<1e-10);
    assert.equal(refractRay([Math.sqrt(.75),.5],[0,-1],1.5),null);
});
