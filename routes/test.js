"use strict";

const express = require("express");
const net = require("net");
const { getVisibleIp } = require("../middleware/rateLimit");

function createTestRouter({ logStore, trustProxy }) {
    const router = express.Router();

    router.post("/", (req, res) => {
        if (req.body?.consent !== true) {
            return res.status(400).json({
                error: "Explicit consent is required before a test can be recorded."
            });
        }

        const ip = getVisibleIp(req, trustProxy);
        if (ip === "unknown" || net.isIP(ip.replace(/^::ffff:/, "")) === 0) {
            return res.status(400).json({
                error: "The server could not identify a valid network address for this request."
            });
        }

        const timestamp = new Date().toISOString();
        logStore.record({ ip, timestamp, event: "authorized_ip_test" });

        // Deliberately excludes the IP address from process output. The protected
        // log store retains the minimum information needed for this lab.
        console.info(JSON.stringify({ event: "authorized_ip_test_recorded", timestamp }));

        return res.status(201).json({
            ok: true,
            message: "Your authorized IP test was received.",
            redirect: "/results"
        });
    });

    return router;
}

module.exports = { createTestRouter };
