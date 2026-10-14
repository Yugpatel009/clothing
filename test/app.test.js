"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createApp } = require("../server");

function createLab() {
    const logFile = path.join(os.tmpdir(), `traceip-test-${process.pid}-${Date.now()}-${Math.random()}.json`);
    const app = createApp({
        adminUser: "lab-admin",
        adminPassword: "correct-horse-battery-staple",
        logFile,
        trustProxy: false,
        isProduction: false
    });
    const server = http.createServer(app);

    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address();
            resolve({
                port,
                logFile,
                close: () => new Promise((done) => server.close(() => {
                    if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
                    done();
                }))
            });
        });
    });
}

function request(port, { method = "GET", pathname = "/", body, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
        const requestHeaders = { ...headers };
        const payload = body === undefined ? null : JSON.stringify(body);
        if (payload) {
            requestHeaders["Content-Type"] = "application/json";
            requestHeaders["Content-Length"] = Buffer.byteLength(payload);
        }

        const req = http.request({ hostname: "127.0.0.1", port, path: pathname, method, headers: requestHeaders }, (res) => {
            let responseBody = "";
            res.setEncoding("utf8");
            res.on("data", (chunk) => { responseBody += chunk; });
            res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: responseBody }));
        });
        req.on("error", reject);
        if (payload) req.write(payload);
        req.end();
    });
}

function adminHeaders() {
    return {
        Authorization: `Basic ${Buffer.from("lab-admin:correct-horse-battery-staple").toString("base64")}`
    };
}

test("serves a consent-first landing page with security headers", async (t) => {
    const lab = await createLab();
    t.after(lab.close);

    const response = await request(lab.port);
    assert.equal(response.status, 200);
    assert.match(response.body, /type="checkbox" required/);
    assert.match(response.body, /Start authorized test/);
    assert.match(response.headers["content-security-policy"], /default-src 'self'/);
    assert.equal(response.headers["x-powered-by"], undefined);
});

test("records a test only after explicit consent and keeps logs behind admin auth", async (t) => {
    const lab = await createLab();
    t.after(lab.close);

    const refused = await request(lab.port, { method: "POST", pathname: "/test", body: { consent: false } });
    assert.equal(refused.status, 400);
    assert.match(refused.body, /Explicit consent/);

    const accepted = await request(lab.port, { method: "POST", pathname: "/test", body: { consent: true } });
    assert.equal(accepted.status, 201);
    assert.equal(JSON.parse(accepted.body).redirect, "/results");
    const storedLogs = JSON.parse(fs.readFileSync(lab.logFile, "utf8"));
    assert.equal(storedLogs.length, 1);
    assert.equal(storedLogs[0].event, "authorized_ip_test");
    assert.equal(storedLogs[0].ip, "127.0.0.1");

    const results = await request(lab.port, { pathname: "/results" });
    assert.equal(results.status, 200);
    assert.doesNotMatch(results.body, /127\.0\.0\.1/);

    const publicAttempt = await request(lab.port, { pathname: "/admin/api/logs" });
    assert.equal(publicAttempt.status, 401);

    const protectedLogs = await request(lab.port, { pathname: "/admin/api/logs", headers: adminHeaders() });
    const payload = JSON.parse(protectedLogs.body);
    assert.equal(protectedLogs.status, 200);
    assert.equal(protectedLogs.headers["cache-control"], "no-store, private");
    assert.equal(payload.logs.length, 1);
    assert.equal(payload.logs[0].event, "authorized_ip_test");
});

test("requires authenticated, explicit confirmation before deleting logs", async (t) => {
    const lab = await createLab();
    t.after(lab.close);
    await request(lab.port, { method: "POST", pathname: "/test", body: { consent: true } });

    const missingConfirmation = await request(lab.port, {
        method: "DELETE",
        pathname: "/admin/api/logs",
        headers: adminHeaders(),
        body: { confirm: "no" }
    });
    assert.equal(missingConfirmation.status, 400);

    const removed = await request(lab.port, {
        method: "DELETE",
        pathname: "/admin/api/logs",
        headers: adminHeaders(),
        body: { confirm: "DELETE_ALL_LOGS" }
    });
    assert.equal(removed.status, 200);
    assert.equal(JSON.parse(removed.body).deleted, 1);

    const logs = await request(lab.port, { pathname: "/admin/api/logs", headers: adminHeaders() });
    assert.equal(JSON.parse(logs.body).summary.total, 0);
});

test("stores logs reliably even if the log file is currently open in an editor or viewer", async (t) => {
    const lab = await createLab();
    t.after(lab.close);

    // Initial write
    await request(lab.port, { method: "POST", pathname: "/test", body: { consent: true } });

    // Open read handle on logFile to simulate an editor/viewer/watcher holding it open
    const fd = fs.openSync(lab.logFile, "r");
    try {
        const response = await request(lab.port, { method: "POST", pathname: "/test", body: { consent: true } });
        assert.equal(response.status, 201);
    } finally {
        fs.closeSync(fd);
    }

    const storedLogs = JSON.parse(fs.readFileSync(lab.logFile, "utf8"));
    assert.equal(storedLogs.length, 2);
});

