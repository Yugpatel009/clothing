"use strict";

const express = require("express");
const path = require("path");
const { requireAdmin } = require("../middleware/auth");

function positiveInteger(value, fallback, maximum) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function createAdminRouter({ logStore, username, password, dashboardPath }) {
    const router = express.Router();
    router.use(requireAdmin({ username, password }));
    router.use((req, res, next) => {
        res.set({
            "Cache-Control": "no-store, private",
            Pragma: "no-cache"
        });
        next();
    });

    router.get("/", (req, res) => {
        res.sendFile(path.resolve(dashboardPath));
    });

    router.get("/api/logs", (req, res) => {
        const page = positiveInteger(req.query.page, 1, 100000);
        const limit = positiveInteger(req.query.limit, 10, 50);
        const query = typeof req.query.query === "string" ? req.query.query.slice(0, 80) : "";

        return res.json({
            ...logStore.getPage({ page, limit, query }),
            summary: logStore.getSummary()
        });
    });

    router.delete("/api/logs", (req, res) => {
        if (req.body?.confirm !== "DELETE_ALL_LOGS") {
            return res.status(400).json({
                error: "Deletion requires an explicit confirmation value."
            });
        }

        const deleted = logStore.clear();
        console.info(JSON.stringify({
            event: "authorized_log_deletion",
            timestamp: new Date().toISOString(),
            deleted
        }));
        return res.json({ ok: true, deleted });
    });

    return router;
}

module.exports = { createAdminRouter };
