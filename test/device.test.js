"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

// Read device-detector.js and evaluate in VM to test without package.json type changes
const vm = require("node:vm");
const detectorCode = fs.readFileSync(path.join(__dirname, "..", "device-detector.js"), "utf8")
    .replace(/^export\s+/gm, "");

const context = { window: { screen: { width: 1920, height: 1080 } }, navigator: { language: "en-US" } };
vm.createContext(context);
vm.runInContext(detectorCode + "; this.detectDevice = detectDevice;", context);
const { detectDevice } = context;

test("detects iPhone device, iOS version, and Safari browser", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
    const result = detectDevice(ua, "iPhone");
    assert.equal(result.type, "Mobile");
    assert.equal(result.model, "Apple iPhone");
    assert.equal(result.os, "iOS 17.4");
    assert.match(result.browser, /Safari 17/);
});

test("detects Android device model, OS, and Chrome", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; SM-S908B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
    const result = detectDevice(ua, "Linux armv8l");
    assert.equal(result.type, "Mobile");
    assert.equal(result.model, "SM-S908B");
    assert.equal(result.os, "Android 14");
    assert.match(result.browser, /Chrome 123/);
});

test("detects Windows 10/11 desktop and Edge", () => {
    const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0";
    const result = detectDevice(ua, "Win32");
    assert.equal(result.type, "Desktop");
    assert.equal(result.model, "Windows PC");
    assert.equal(result.os, "Windows 10 / 11");
    assert.match(result.browser, /Edge 124/);
});

test("detects Apple Mac desktop and macOS", () => {
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
    const result = detectDevice(ua, "MacIntel");
    assert.equal(result.type, "Desktop");
    assert.equal(result.model, "Apple Mac");
    assert.equal(result.os, "macOS 14.4.1");
});

test("detects Apple iPad tablet", () => {
    const ua = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const result = detectDevice(ua, "iPad");
    assert.equal(result.type, "Tablet");
    assert.equal(result.model, "Apple iPad");
    assert.equal(result.os, "iOS 17.0");
});
