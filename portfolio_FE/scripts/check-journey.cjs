const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { readFile } = require("node:fs/promises");
const path = require("node:path");
const { chromium, webkit } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = path.resolve("dist");
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".webp": "image/webp" };
const server = createServer(async (req, res) => {
    try {
        let name = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        if (name.endsWith("/")) name += "index.html";
        const file = path.resolve(root, "." + name);
        if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
        res.setHeader("Content-Type", mime[path.extname(file)] || "application/octet-stream");
        res.end(await readFile(file));
    } catch {
        res.writeHead(404).end();
    }
});

async function inspect(page) {
    return page.evaluate(() => {
        const section = document.querySelector(".journey-stack");
        const stage = section.querySelector(".journey-viewport");
        const cards = [...section.querySelectorAll("[data-stack-card]")];
        return {
            flow: section.classList.contains("journey-flow"),
            stageHeight: stage.getBoundingClientRect().height,
            heights: cards.map(c => c.getBoundingClientRect().height),
            complete: cards.every(c => {
                const body = c.querySelector(".edit-body");
                return body.scrollHeight <= body.clientHeight + 2 &&
                    getComputedStyle(body).overflowY === "visible";
            }),
            headings: ["about", "journey", "projects"].map(id =>
                document.querySelector("#" + id + " .chapter-mark").getBoundingClientRect().width),
        };
    });
}

(async () => {
    await new Promise(resolve => server.listen(4322, "127.0.0.1", resolve));
    for (const [name, engine] of Object.entries({ chromium, webkit })) {
        const browser = await engine.launch();
        try {
            const page = await browser.newPage({ viewport: { width: 390, height: 650 }, isMobile: true, hasTouch: true });
            const errors = [];
            page.on("pageerror", error => errors.push(error.message));
            await page.goto("http://127.0.0.1:4322/", { waitUntil: "networkidle" });
            await page.evaluate(() => document.fonts.ready);
            await page.waitForFunction(() => document.querySelector(".journey-stack").style.getPropertyValue("--journey-card-height"));
            const before = await inspect(page);
            assert.equal(before.heights.length, 5);
            assert(before.complete, name + ": card content is clipped or internally scrollable");
            assert(before.headings.every(w => Math.abs(w - before.headings[2]) < 1), name + ": numeral widths differ");
            if (!before.flow) {
                assert(before.heights.every(h => Math.abs(h - before.heights[0]) < 1), name + ": pinned cards differ in height");
            }

            for (const height of [780, 650]) {
                await page.setViewportSize({ width: 390, height });
                await page.waitForTimeout(400);
                const after = await inspect(page);
                assert.deepEqual(after.heights, before.heights, name + ": height-only resize changed cards");
                assert.equal(after.stageHeight, before.stageHeight, name + ": height-only resize changed stage");
                assert(after.complete, name + ": text became clipped");
            }
            await page.setViewportSize({ width: 844, height: 390 });
            await page.waitForTimeout(600);
            const landscape = await inspect(page);
            assert(landscape.flow && landscape.complete, name + ": short-screen flow does not expose all content");

            await page.setViewportSize({ width: 390, height: 650 });
            await page.waitForTimeout(600);
            assert((await inspect(page)).complete, name + ": rotation back clips content");
            assert.deepEqual(errors, [], name + ": browser errors");
            console.log(name + ": five cards, full content, uniform marks, stable height-only resizing and rotation passed");
        } finally {
            await browser.close();
        }
    }
})().catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => server.close());
