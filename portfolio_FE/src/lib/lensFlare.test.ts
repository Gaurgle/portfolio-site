import { test } from "node:test";
import assert from "node:assert/strict";
import { flarePass } from "./lensFlare.ts";

test("no flare before the arrow fills in or once it has left", () => {
    for(const life of [-3,0,1,1.2,40]) assert.equal(flarePass(life).strength,0, `lit at ${life}`);
});

test("the flare eases in and out without a step and holds while the arrow stands", () => {
    let previous=0;
    for(let life=0;life<=1.0001;life+=.005) {
        const {strength}=flarePass(life);
        assert.ok(strength>=0 && strength<=1);
        assert.ok(Math.abs(strength-previous)<.04, `strength jumped at ${life}`);
        previous=strength;
    }
    // .55 is the arrow complete and dwelling: the light is overhead.
    for(const life of [.3,.55,.7]) assert.equal(flarePass(life).strength,1);
});

test("the unseen light tracks the arrow's life and reverses with the scroll", () => {
    for(const life of [.1,.4,.55,.9]) assert.equal(flarePass(life).travel,life);
    assert.equal(flarePass(-1).travel,0);
    assert.equal(flarePass(7).travel,1);
    assert.deepEqual(flarePass(.4),flarePass(.4));
    assert.ok(Object.values(flarePass(Number.MAX_VALUE)).every(Number.isFinite));
});
