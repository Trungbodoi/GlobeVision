import { test } from "vitest";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("PWA manifest declares installable standard-size icons and offline app assets", () => {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public", "manifest.webmanifest"), "utf8")
  );
  const iconSizes = new Set(manifest.icons.map((icon) => icon.sizes));
  assert.ok(iconSizes.has("192x192"));
  assert.ok(iconSizes.has("512x512"));
  for (const icon of manifest.icons.filter((item) => item.type === "image/png")) {
    const iconPath = path.join(ROOT, "public", icon.src.replace("./", ""));
    assert.ok(fs.existsSync(iconPath));
    const image = fs.readFileSync(iconPath);
    const [expectedWidth, expectedHeight] = icon.sizes.split("x").map(Number);
    assert.equal(image.readUInt32BE(16), expectedWidth);
    assert.equal(image.readUInt32BE(20), expectedHeight);
  }

  const worker = fs.readFileSync(path.join(ROOT, "public", "sw.js"), "utf8");
  for (const asset of ["countries.geojson", "boundaries.geojson", "geography.geojson", "build-manifest.json"]) {
    assert.ok(worker.includes(asset), `Service Worker should cache ${asset}`);
  }
});

test("Open Graph image and metadata are available at declared dimensions", () => {
  const image = fs.readFileSync(path.join(ROOT, "public", "og-image.png"));
  assert.equal(image.toString("ascii", 1, 4), "PNG");
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);

  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const property of ["og:title", "og:description", "og:image", "twitter:card"]) {
    assert.ok(html.includes(`name="${property}"`) || html.includes(`property="${property}"`));
  }
});
