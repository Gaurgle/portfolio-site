import { test } from "node:test";
import assert from "node:assert/strict";
import { refractRay, spectralPaths, tracePrism } from "./prismOptics.ts";

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
