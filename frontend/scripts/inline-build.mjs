import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const distDirectory = resolve(scriptDirectory, "..", "dist");
const htmlPath = resolve(distDirectory, "index.html");

let html = await readFile(htmlPath, "utf8");

const stylesheetPattern = /<link\s+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/i;
const scriptPattern = /<script\s+type="module"[^>]*src="([^"]+)"[^>]*><\/script>/i;

const stylesheetMatch = html.match(stylesheetPattern);
if (!stylesheetMatch) {
  throw new Error("Could not find the built CSS file in dist/index.html");
}

const cssPath = resolve(distDirectory, stylesheetMatch[1].replace(/^\//, ""));
const css = await readFile(cssPath, "utf8");
html = html.replace(stylesheetPattern, () => `<style>\n${css}\n</style>`);

const scriptMatch = html.match(scriptPattern);
if (!scriptMatch) {
  throw new Error("Could not find the built JavaScript file in dist/index.html");
}

const scriptPath = resolve(distDirectory, scriptMatch[1].replace(/^\//, ""));
const javascript = await readFile(scriptPath, "utf8");
const safeJavascript = javascript.replace(/<\/script/gi, "<\\/script");
html = html.replace(
  scriptPattern,
  () => `<script type="module">\n${safeJavascript}\n</script>`,
);

await writeFile(htmlPath, html, "utf8");
console.log("Inlined CSS and JavaScript into dist/index.html");
