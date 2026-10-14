import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const testDir = dirname(fileURLToPath(import.meta.url));
const modulePath = resolve(testDir, "../src/dual-mode/app-mode-ui.js");
const cssPath = resolve(testDir, "../src/dual-mode/app-mode.css");
const exactDestination = "https://missionmedinstitute.com/member-dashboard/#dashboard";

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.parentNode = null;
    this.id = "";
    this.href = "";
    this.onclick = null;
    this._innerHTML = "";
  }

  get firstChild() { return this.children[0] || null; }
  get firstElementChild() { return this.firstChild; }
  set className(value) { this.setAttribute("class", value); }
  get textContent() {
    return this._innerHTML.replace(/<[^>]+>/g, "").replace("&#8592;", "←");
  }

  set innerHTML(value) { this._innerHTML = value; }
  get innerHTML() { return this._innerHTML; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  insertBefore(child, before) {
    child.parentNode = this;
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
    return child;
  }
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function loadUi() {
  const body = new FakeElement("body");
  const host = body.appendChild(new FakeElement("div"));
  host.id = "mm-header-appchrome-left";
  const menu = host.appendChild(new FakeElement("div"));
  menu.id = "appMenuBar";
  const document = {
    body,
    readyState: "loading",
    addEventListener() {},
    createElement(tagName) { return new FakeElement(tagName); },
    getElementById(id) { return findById(body, id); }
  };
  const root = { document };
  const previousWindow = global.window;
  global.window = root;
  delete require.cache[require.resolve(modulePath)];
  const ui = require(modulePath);
  global.window = previousWindow;
  return { document, ui };
}

test("native Return to Matrix link is semantic, exact, and idempotent", () => {
  const { document, ui } = loadUi();
  ui.addReturnToMatrixLink();
  ui.addReturnToMatrixLink();
  const host = document.getElementById("mm-header-appchrome-left");
  const links = host.children.filter((child) => child.id === "rlqReturnToMatrix");
  assert.equal(links.length, 1);
  const link = links[0];
  assert.equal(link.tagName, "A");
  assert.equal(link.href, exactDestination);
  assert.equal(link.getAttribute("target"), null);
  assert.equal(link.getAttribute("aria-label"), "Return to Matrix");
  assert.equal(link.textContent.replace(/\s+/g, " ").trim(), "←Return to Matrix");
  assert.equal(link.onclick, null);
  assert.equal(ui.MATRIX_DASHBOARD_URL, exactDestination);
});

test("native link precedes existing app navigation without replacing it", () => {
  const { document, ui } = loadUi();
  const link = ui.addReturnToMatrixLink();
  const host = document.getElementById("mm-header-appchrome-left");
  assert.equal(host.firstElementChild, link);
  assert.ok(document.getElementById("appMenuBar"));
});

test("Return control keeps visible focus and compact 390px styling", () => {
  const css = readFileSync(cssPath, "utf8");
  assert.match(css, /\.rlq-return-to-matrix:focus-visible\s*\{[^}]*outline:/s);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*\.rlq-return-to-matrix\s*\{/);
  assert.doesNotMatch(css, /\.rlq-return-to-matrix(?:__label)?[^{}]*\{[^}]*display:\s*none/s);
});
