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
    cell.colSpan = 5;
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

        // 1. IP
        const ipCell = document.createElement("td");
        const ipCode = document.createElement("code");
        ipCode.textContent = log.ip || "Unknown IP";
        ipCell.append(ipCode);

        // 2. Device / Model
        const devCell = document.createElement("td");
        const devType = log.device?.type || "Desktop";
        const devTypeBadge = document.createElement("span");
        devTypeBadge.className = `device-badge type-badge-${devType.toLowerCase()}`;
        devTypeBadge.textContent = devType;

        const devNameSpan = document.createElement("strong");
        devNameSpan.style.display = "block";
        devNameSpan.style.marginTop = "0.25rem";
        devNameSpan.textContent = log.device?.model || "Standard Device";

        devCell.append(devTypeBadge, devNameSpan);

        if (log.device?.customName) {
            const customTag = document.createElement("span");
            customTag.className = "custom-device-tag";
            customTag.textContent = `Label: "${log.device.customName}"`;
            devCell.append(customTag);
        }

        // 3. OS & Browser
        const osCell = document.createElement("td");
        const osText = document.createElement("div");
        osText.textContent = log.device?.os || "Unknown OS";
        const browserText = document.createElement("small");
        browserText.style.color = "var(--muted)";
        browserText.textContent = log.device?.browser || "";
        osCell.append(osText, browserText);

        // 4. Timestamp
        const timeCell = document.createElement("td");
        timeCell.textContent = formatUtc(log.timestamp);

        // 5. Action (Delete)
        const actionCell = document.createElement("td");
        actionCell.style.textAlign = "right";
        const delBtn = document.createElement("button");
        delBtn.className = "delete-row-button";
        delBtn.textContent = "✕ Delete";
        delBtn.type = "button";
        delBtn.addEventListener("click", async () => {
            if (!confirm(`Delete log record for ${log.ip}?`)) return;
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

        row.append(ipCell, devCell, osCell, timeCell, actionCell);
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
    for (const l of logs) {
        const t = (l.device?.type || "").toLowerCase();
        if (t === "mobile" || t === "tablet") mobileCount++;
        else desktopCount++;
    }

    document.querySelector("#total-count").textContent = total;
    document.querySelector("#day-count").textContent = last24Hours;
    document.querySelector("#device-ratio").textContent = `${mobileCount} Mob / ${desktopCount} Desk`;
    document.querySelector("#latest-test").textContent = logs[0] ? formatUtc(logs[0].timestamp) : "No records";
}

// 5. Filtering & Pagination
function filterAndPaginate() {
    const q = state.query.toLowerCase();
    state.filteredLogs = state.allLogs.filter((log) => {
        if (!q) return true;
        const haystack = `${log.ip} ${log.device?.model} ${log.device?.customName} ${log.device?.os} ${log.device?.browser} ${log.timestamp}`.toLowerCase();
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
