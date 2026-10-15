"use strict";

import {
    fetchLogs,
    deleteSingleLog,
    clearAllRecords,
    isFirebaseConfigured,
    ADMIN_PASSWORD
} from "./firebase-config.js";

const AUTH_KEY = "traceip_admin_authed";

const authOverlay = document.querySelector("#auth-overlay");
const authForm = document.querySelector("#auth-form");
const authPassword = document.querySelector("#auth-password");
const authError = document.querySelector("#auth-error");
const lockButton = document.querySelector("#lock-dashboard");
const storageStatus = document.querySelector("#storage-status");

const body = document.querySelector("#log-body");
const status = document.querySelector("#page-status");
const actionStatus = document.querySelector("#action-status");
const search = document.querySelector("#log-search");
const previous = document.querySelector("#previous-page");
const next = document.querySelector("#next-page");
const clearLogs = document.querySelector("#clear-logs");

const state = {
    allLogs: [],
    filteredLogs: [],
    page: 1,
    limit: 10,
    totalPages: 1,
    query: ""
};

// 1. Password Protection Handling
function isAuthenticated() {
    return sessionStorage.getItem(AUTH_KEY) === "true";
}

function checkAuth() {
    if (isAuthenticated()) {
        authOverlay.style.display = "none";
        loadDashboard();
    } else {
        authOverlay.style.display = "flex";
        authPassword.value = "";
        authPassword.focus();
    }
}

authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (authPassword.value === ADMIN_PASSWORD) {
        sessionStorage.setItem(AUTH_KEY, "true");
        authError.textContent = "";
        authOverlay.style.display = "none";
        loadDashboard();
    } else {
        authError.textContent = "Incorrect password. Please try again.";
        authPassword.value = "";
    }
});

lockButton.addEventListener("click", () => {
    sessionStorage.removeItem(AUTH_KEY);
    checkAuth();
});

// 2. Formatting Helpers
function formatUtc(timestamp) {
    if (!timestamp) return "No records";
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "medium",
            timeZone: "UTC"
        }).format(new Date(timestamp)) + " UTC";
    } catch {
        return timestamp;
    }
}

function setRow(message, className) {
    body.replaceChildren();
    const row = document.createElement("tr");
    row.className = className;
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = message;
    row.append(cell);
    body.append(row);
}

// 3. Render Table Rows
function renderLogs(logs) {
    body.replaceChildren();
    if (!logs.length) {
        setRow("No retained test logs match this view.", "empty-row");
        return;
    }

    for (const log of logs) {
        const row = document.createElement("tr");

        // 1. Device ID & Hardware
        const devCell = document.createElement("td");
        
        // Persistent Unique Device ID badge
        const devId = log.deviceId || log.device?.deviceId || "DEV-UNKNOWN";
        const devIdBadge = document.createElement("span");
        devIdBadge.className = "device-id-badge";
        devIdBadge.textContent = devId;
        devCell.append(devIdBadge);

        // Device Model & Type Badge
        const modelRow = document.createElement("div");
        modelRow.style.display = "flex";
        modelRow.style.alignItems = "center";
        modelRow.style.gap = "0.4rem";
        modelRow.style.marginTop = "0.2rem";

        const devType = log.device?.type || "Desktop";
        const devTypeBadge = document.createElement("span");
        devTypeBadge.className = `device-badge type-badge-${devType.toLowerCase()}`;
        devTypeBadge.textContent = devType;

        const devNameSpan = document.createElement("strong");
        devNameSpan.textContent = log.device?.model || "Standard Device";

        modelRow.append(devTypeBadge, devNameSpan);
        devCell.append(modelRow);

        // GPU Chip
        if (log.device?.gpu && log.device.gpu !== "Standard GPU") {
            const gpuTag = document.createElement("span");
            gpuTag.className = "gpu-chip-tag";
            gpuTag.title = log.device.gpu;
            gpuTag.textContent = `GPU: ${log.device.gpu}`;
            devCell.append(gpuTag);
        }

        if (log.device?.customName) {
            const customTag = document.createElement("span");
            customTag.className = "custom-device-tag";
            customTag.textContent = `Label: "${log.device.customName}"`;
            devCell.append(customTag);
        }

        // 2. IP & Network Connectivity
        const ipCell = document.createElement("td");
        const ipGroup = document.createElement("div");
        ipGroup.className = "ip-group";

        const netType = log.networkType || (log.ipv4 && log.ipv6 ? "Dual-Stack" : log.ipv6 ? "IPv6 Only" : "IPv4 Only");
        const typeBadge = document.createElement("span");
        typeBadge.className = `network-badge ${netType.includes("Dual") ? "network-dual" : netType.includes("6") ? "network-v6" : "network-v4"}`;
        typeBadge.textContent = netType;
        ipGroup.append(typeBadge);

        // IPv4 entry
        const v4Row = document.createElement("div");
        v4Row.className = "ip-entry";
        const v4Tag = document.createElement("span");
        v4Tag.className = "ip-tag ip-tag-v4";
        v4Tag.textContent = "IPv4";
        v4Row.append(v4Tag);
        if (log.ipv4) {
            const v4Code = document.createElement("code");
            v4Code.className = "ip-code";
            v4Code.textContent = log.ipv4;
            v4Row.append(v4Code);
        } else {
            const v4Span = document.createElement("span");
            v4Span.className = "ip-unsupported";
            v4Span.textContent = "None / Unsupported";
            v4Row.append(v4Span);
        }
        ipGroup.append(v4Row);

        // IPv6 entry
        const v6Row = document.createElement("div");
        v6Row.className = "ip-entry";
        const v6Tag = document.createElement("span");
        v6Tag.className = "ip-tag ip-tag-v6";
        v6Tag.textContent = "IPv6";
        v6Row.append(v6Tag);
        if (log.ipv6) {
            const v6Code = document.createElement("code");
            v6Code.className = "ip-code";
            v6Code.textContent = log.ipv6;
            v6Row.append(v6Code);
        } else {
            const v6Span = document.createElement("span");
            v6Span.className = "ip-unsupported";
            v6Span.textContent = "None / Unsupported";
            v6Row.append(v6Span);
        }
        ipGroup.append(v6Row);

        // Connection Speed / Telemetry
        if (log.connection?.downlink || (log.connection?.type && log.connection.type !== "Unknown")) {
            const connSpeed = document.createElement("span");
            connSpeed.className = "conn-speed-tag";
            const parts = [];
            if (log.connection.type && log.connection.type !== "Unknown") parts.push(log.connection.type);
            if (log.connection.downlink) parts.push(log.connection.downlink);
            if (log.connection.rtt) parts.push(log.connection.rtt);
            connSpeed.textContent = parts.join(" · ");
            ipGroup.append(connSpeed);
        }

        ipCell.append(ipGroup);

        // 3. Location & ISP Carrier
        const locCell = document.createElement("td");
        const locGroup = document.createElement("div");
        locGroup.className = "location-group";

        const loc = log.location || {};
        const flag = loc.flag || "🌐";
        const cityText = loc.city && loc.city !== "Unknown City" ? loc.city : "Detected Location";
        const countryText = loc.country || "";

        const cityEl = document.createElement("div");
        cityEl.className = "location-city";
        cityEl.textContent = `${flag} ${cityText}${countryText ? ", " + countryText : ""}`;
        locGroup.append(cityEl);

        if (loc.isp && loc.isp !== "Unknown ISP") {
            const ispEl = document.createElement("div");
            ispEl.className = "location-isp";
            ispEl.textContent = loc.isp;
            locGroup.append(ispEl);
        }

        if (loc.timezone || log.device?.timezone) {
            const tzEl = document.createElement("small");
            tzEl.style.color = "var(--muted)";
            tzEl.style.fontSize = "0.72rem";
            tzEl.textContent = loc.timezone || log.device?.timezone || "";
            locGroup.append(tzEl);
        }

        locCell.append(locGroup);

        // 4. OS, Browser & Screen
        const osCell = document.createElement("td");
        const osText = document.createElement("div");
        osText.style.fontWeight = "600";
        osText.textContent = log.device?.os || "Unknown OS";

        const browserText = document.createElement("small");
        browserText.style.color = "var(--muted)";
        browserText.style.display = "block";
        browserText.textContent = log.device?.browser || "";

        const specText = document.createElement("span");
        specText.className = "hardware-spec-tag";
        const hardwareSpecs = [];
        if (log.device?.screen && log.device.screen !== "0x0") hardwareSpecs.push(log.device.screen);
        if (log.device?.cpu && log.device.cpu !== "Unknown") hardwareSpecs.push(log.device.cpu);
        if (log.device?.memory && log.device.memory !== "Unknown") hardwareSpecs.push(log.device.memory);
        specText.textContent = hardwareSpecs.join(" · ");

        osCell.append(osText, browserText, specText);

        // 5. Timestamp
        const timeCell = document.createElement("td");
        timeCell.textContent = formatUtc(log.timestamp);

        // 6. Action (Delete)
        const actionCell = document.createElement("td");
        actionCell.style.textAlign = "right";
        const delBtn = document.createElement("button");
        delBtn.className = "delete-row-button";
        delBtn.textContent = "✕ Delete";
        delBtn.type = "button";
        delBtn.addEventListener("click", async () => {
            const identifier = devId !== "DEV-UNKNOWN" ? devId : (log.ipv4 || log.ipv6 || log.ip);
            if (!confirm(`Delete log record for ${identifier}?`)) return;
            delBtn.disabled = true;
            delBtn.textContent = "Deleting…";
            try {
                await deleteSingleLog(log.id);
                state.allLogs = state.allLogs.filter((l) => l.id !== log.id);
                filterAndPaginate();
            } catch (err) {
                alert("Failed to delete log: " + err.message);
                delBtn.disabled = false;
                delBtn.textContent = "✕ Delete";
            }
        });
        actionCell.append(delBtn);

        row.append(devCell, ipCell, locCell, osCell, timeCell, actionCell);
        body.append(row);
    }
}

// 4. Summary Stats Calculation
function renderSummary(logs) {
    const total = logs.length;
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const last24Hours = logs.filter((l) => Date.parse(l.timestamp) >= dayAgo).length;

    let mobileCount = 0;
    let desktopCount = 0;
    let dualCount = 0;
    let v4Count = 0;
    let v6Count = 0;
    const uniqueDeviceIds = new Set();

    for (const l of logs) {
        const id = l.deviceId || l.device?.deviceId;
        if (id) uniqueDeviceIds.add(id);

        const t = (l.device?.type || "").toLowerCase();
        if (t === "mobile" || t === "tablet") mobileCount++;
        else desktopCount++;

        const net = (l.networkType || "").toLowerCase();
        if (net.includes("dual") || (l.ipv4 && l.ipv6)) dualCount++;
        else if (net.includes("6") || l.ipv6) v6Count++;
        else v4Count++;
    }

    document.querySelector("#total-count").textContent = total;
    const uniqueEl = document.querySelector("#unique-devices-count");
    if (uniqueEl) {
        uniqueEl.textContent = uniqueDeviceIds.size || (total ? 1 : 0);
    }
    document.querySelector("#day-count").textContent = last24Hours;
    document.querySelector("#device-ratio").textContent = `${mobileCount} Mob / ${desktopCount} Desk`;
    const netRatio = document.querySelector("#network-ratio");
    if (netRatio) {
        netRatio.textContent = `${dualCount} Dual / ${v4Count} v4 / ${v6Count} v6`;
    }
}

// 5. Filtering & Pagination
function filterAndPaginate() {
    const q = state.query.toLowerCase();
    state.filteredLogs = state.allLogs.filter((log) => {
        if (!q) return true;
        const haystack = `${log.deviceId || ""} ${log.device?.deviceId || ""} ${log.ip || ""} ${log.ipv4 || ""} ${log.ipv6 || ""} ${log.networkType || ""} ${log.location?.city || ""} ${log.location?.country || ""} ${log.location?.isp || ""} ${log.device?.gpu || ""} ${log.device?.model || ""} ${log.device?.customName || ""} ${log.device?.os || ""} ${log.device?.browser || ""} ${log.timestamp || ""}`.toLowerCase();
        return haystack.includes(q);
    });

    const total = state.filteredLogs.length;
    state.totalPages = Math.max(1, Math.ceil(total / state.limit));
    state.page = Math.min(state.page, state.totalPages);

    const start = (state.page - 1) * state.limit;
    const pageItems = state.filteredLogs.slice(start, start + state.limit);

    renderLogs(pageItems);
    renderSummary(state.allLogs);

    status.textContent = `Page ${state.page} of ${state.totalPages} · ${total} record${total === 1 ? "" : "s"}`;
    previous.disabled = state.page <= 1;
    next.disabled = state.page >= state.totalPages;
}

// 6. Data Loading
async function loadDashboard() {
    setRow("Loading records from cloud…", "loading-row");

    if (isFirebaseConfigured()) {
        storageStatus.textContent = "Firebase Firestore";
        storageStatus.className = "storage-badge storage-firebase";
    } else {
        storageStatus.textContent = "Local Demo Storage";
        storageStatus.className = "storage-badge storage-local";
        storageStatus.title = "Paste your Firebase keys into firebase-config.js to enable cloud database";
    }

    try {
        state.allLogs = await fetchLogs(300);
        state.page = 1;
        filterAndPaginate();
    } catch (err) {
        console.error("Dashboard load failed:", err);
        setRow("Unable to load records: " + err.message, "error-row");
    }
}

// 7. Event Listeners
let searchTimer;
search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
        state.query = search.value.trim();
        state.page = 1;
        filterAndPaginate();
    }, 200);
});

previous.addEventListener("click", () => {
    if (state.page > 1) {
        state.page -= 1;
        filterAndPaginate();
    }
});

next.addEventListener("click", () => {
    if (state.page < state.totalPages) {
        state.page += 1;
        filterAndPaginate();
    }
});

clearLogs.addEventListener("click", async () => {
    if (!state.allLogs.length) return;
    const confirmed = confirm("Are you sure you want to delete ALL captured test logs? This cannot be undone.");
    if (!confirmed) return;

    clearLogs.disabled = true;
    actionStatus.textContent = "Deleting all logs…";
    try {
        await clearAllRecords();
        state.allLogs = [];
        state.page = 1;
        filterAndPaginate();
        actionStatus.textContent = "All logs were deleted successfully.";
    } catch (err) {
        actionStatus.textContent = "Failed to clear logs: " + err.message;
    } finally {
        clearLogs.disabled = false;
    }
});

// Initial boot
checkAuth();
