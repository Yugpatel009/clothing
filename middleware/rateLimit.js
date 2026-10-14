"use strict";

function getVisibleIp(req, trustProxy) {
    if (trustProxy) {
        return req.ip || "unknown";
    }

    return req.socket.remoteAddress || "unknown";
}

function createRateLimiter({ windowMs, max, trustProxy }) {
    const requests = new Map();

    return (req, res, next) => {
        const now = Date.now();
        const key = getVisibleIp(req, trustProxy);
        const record = requests.get(key);

        if (!record || record.resetAt <= now) {
            requests.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        record.count += 1;
        if (record.count > max) {
            const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
            res.set("Retry-After", String(retryAfter));
            return res.status(429).json({
                error: "Too many requests. Please wait before trying again."
            });
        }

        return next();
    };
}

module.exports = { createRateLimiter, getVisibleIp };
