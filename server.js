"use strict";

const express = require("express");
const fs = require("fs");
const path = require("path");
const { applySecurityHeaders } = require("./middleware/security");
const { createRateLimiter } = require("./middleware/rateLimit");
const { createLogStore } = require("./storage/logStore");
const { createTestRouter } = require("./routes/test");
const { createAdminRouter } = require("./routes/admin");

function loadEnvironment(filename = path.join(__dirname, ".env")) {
    if (!fs.existsSync(filename)) return;

    for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match || process.env[match[1]] !== undefined) continue;
        const value = match[2].replace(/^(["'])(.*)\1$/, "$2");
        process.env[match[1]] = value;
    }
}

function boundedInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function resolveConfig(overrides = {}) {
    loadEnvironment();
    return {
        port: boundedInteger(process.env.PORT, 3000, 1, 65535),
        adminUser: process.env.ADMIN_USER || "traceip-admin",
        adminPassword: process.env.ADMIN_PASSWORD || "",
        retentionDays: boundedInteger(process.env.LOG_RETENTION_DAYS, 7, 1, 90),
        trustProxy: process.env.TRUST_PROXY === "true",
        isProduction: process.env.NODE_ENV === "production",
        logFile: process.env.LOG_FILE || path.join(__dirname, "data", "logs.json"),
        ...overrides
    };
}

function createApp(overrides = {}) {
    const config = resolveConfig(overrides);
    const app = express();
    const logStore = createLogStore({
        filePath: config.logFile,
        retentionMs: config.retentionDays * 24 * 60 * 60 * 1000
    });
    const publicPath = path.join(__dirname, "public");

    app.disable("x-powered-by");
    app.set("trust proxy", config.trustProxy);
    app.use(applySecurityHeaders({ isProduction: config.isProduction }));
    app.use(express.json({ limit: "2kb", type: "application/json" }));
    app.use(createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 120,
        trustProxy: config.trustProxy
    }));

    app.use(express.static(publicPath, {
        index: false,
        fallthrough: true,
        maxAge: config.isProduction ? "1h" : 0
    }));

    app.get("/", (req, res) => res.sendFile(path.join(publicPath, "index.html")));
    app.get("/results", (req, res) => res.sendFile(path.join(publicPath, "results.html")));
    app.use("/test", createTestRouter({ logStore, trustProxy: config.trustProxy }));
    app.use("/admin", createRateLimiter({
        windowMs: 15 * 60 * 1000,
        max: 30,
        trustProxy: config.trustProxy
    }));
    app.use("/admin", createAdminRouter({
        logStore,
        username: config.adminUser,
        password: config.adminPassword,
        dashboardPath: path.join(__dirname, "views", "dashboard.html")
    }));

    app.use((req, res) => res.status(404).json({ error: "Not found." }));
    app.use((error, req, res, next) => {
        console.error(JSON.stringify({
            event: "request_error",
            timestamp: new Date().toISOString(),
            type: error.type || error.name
        }));
        const status = error instanceof SyntaxError || error.type === "entity.parse.failed" ? 400 : 500;
        res.status(status).json({
            error: status === 400 ? "Invalid request body." : "The server could not process that request."
        });
    });

    // Run retention cleanup at startup, before any dashboard is accessed.
    logStore.purgeExpired();
    return app;
}

if (require.main === module) {
    const config = resolveConfig();
    const app = createApp(config);
    app.listen(config.port, "0.0.0.0", () => {
        console.info(`TraceIP listening on http://0.0.0.0:${config.port}`);
    });
}

module.exports = { createApp, resolveConfig };
