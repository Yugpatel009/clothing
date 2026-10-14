"use strict";

const crypto = require("crypto");

function credentialsMatch(received, expected) {
    const receivedBuffer = Buffer.from(received, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    return receivedBuffer.length === expectedBuffer.length &&
        crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function requireAdmin({ username, password }) {
    return (req, res, next) => {
        if (!password) {
            return res.status(503).send("Admin access is disabled until ADMIN_PASSWORD is configured.");
        }

        const header = req.get("authorization") || "";
        const [scheme, encoded] = header.split(" ");
        let supplied = "";

        if (scheme === "Basic" && encoded) {
            try {
                supplied = Buffer.from(encoded, "base64").toString("utf8");
            } catch {
                supplied = "";
            }
        }

        const valid = supplied && credentialsMatch(supplied, `${username}:${password}`);
        if (!valid) {
            res.set("WWW-Authenticate", 'Basic realm="TraceIP Admin", charset="UTF-8"');
            return res.status(401).send("Authentication required.");
        }

        return next();
    };
}

module.exports = { requireAdmin };
