"use strict";

const fs = require("fs");
const path = require("path");

function isValidLog(record) {
    return record &&
        record.event === "authorized_ip_test" &&
        typeof record.ip === "string" &&
        record.ip.length > 0 &&
        typeof record.timestamp === "string" &&
        !Number.isNaN(Date.parse(record.timestamp));
}

function createLogStore({ filePath, retentionMs }) {
    function readLogs() {
        try {
            const content = fs.readFileSync(filePath, "utf8");
            if (!content.trim()) {
                return [];
            }
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed.filter(isValidLog) : [];
        } catch (error) {
            if (error.code === "ENOENT") {
                return [];
            }
            throw new Error("Unable to read the protected log store.");
        }
    }

    function writeLogs(logs) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
        fs.writeFileSync(temporaryPath, `${JSON.stringify(logs, null, 2)}\n`, {
            encoding: "utf8",
            mode: 0o600
        });
        try {
            fs.renameSync(temporaryPath, filePath);
        } catch (error) {
            if (error.code === "EPERM" || error.code === "EBUSY" || error.code === "EACCES") {
                fs.copyFileSync(temporaryPath, filePath);
                try {
                    fs.unlinkSync(temporaryPath);
                } catch {
                    // Ignore temp file cleanup errors
                }
            } else {
                try {
                    fs.unlinkSync(temporaryPath);
                } catch {
                    // Ignore temp file cleanup errors
                }
                throw error;
            }
        }
    }

    function purgeExpired() {
        const cutoff = Date.now() - retentionMs;
        const logs = readLogs();
        const retained = logs.filter((log) => Date.parse(log.timestamp) >= cutoff);

        if (retained.length !== logs.length) {
            writeLogs(retained);
        }

        return retained;
    }

    return {
        record({ ip, timestamp, event }) {
            const logs = purgeExpired();
            const entry = { ip, timestamp, event };
            logs.unshift(entry);
            writeLogs(logs);
            return entry;
        },

        getPage({ page, limit, query }) {
            const normalizedQuery = query.trim().toLowerCase();
            const logs = purgeExpired().filter((log) => {
                if (!normalizedQuery) return true;
                return `${log.ip} ${log.event} ${log.timestamp}`.toLowerCase().includes(normalizedQuery);
            });
            const total = logs.length;
            const totalPages = Math.max(1, Math.ceil(total / limit));
            const safePage = Math.min(page, totalPages);
            const start = (safePage - 1) * limit;

            return {
                logs: logs.slice(start, start + limit),
                pagination: { page: safePage, limit, total, totalPages }
            };
        },

        getSummary() {
            const logs = purgeExpired();
            const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
            return {
                total: logs.length,
                last24Hours: logs.filter((log) => Date.parse(log.timestamp) >= dayAgo).length,
                latestTimestamp: logs[0] ? logs[0].timestamp : null
            };
        },

        clear() {
            const count = purgeExpired().length;
            writeLogs([]);
            return count;
        },

        purgeExpired
    };
}

module.exports = { createLogStore };
