"use strict";

const state = { page: 1, totalPages: 1, query: "" };
const body = document.querySelector("#log-body");
const status = document.querySelector("#page-status");
const actionStatus = document.querySelector("#action-status");
const search = document.querySelector("#log-search");
const previous = document.querySelector("#previous-page");
const next = document.querySelector("#next-page");
const clearLogs = document.querySelector("#clear-logs");

function formatUtc(timestamp) {
    if (!timestamp) return "No records";
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "UTC"
    }).format(new Date(timestamp)) + " UTC";
}

function setRow(message, className) {
    body.replaceChildren();
    const row = document.createElement("tr");
    row.className = className;
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.textContent = message;
    row.append(cell);
    body.append(row);
}

function renderLogs(logs) {
    body.replaceChildren();
    if (!logs.length) {
        setRow("No retained test logs match this view.", "empty-row");
        return;
    }

    for (const log of logs) {
        const row = document.createElement("tr");
        const ip = document.createElement("td");
        const ipCode = document.createElement("code");
        ipCode.textContent = log.ip;
        ip.append(ipCode);

        const timestamp = document.createElement("td");
        timestamp.textContent = formatUtc(log.timestamp);

        const event = document.createElement("td");
        const eventTag = document.createElement("span");
        eventTag.className = "event-tag";
        eventTag.textContent = log.event;
        event.append(eventTag);
        row.append(ip, timestamp, event);
        body.append(row);
    }
}

function renderSummary(summary) {
    document.querySelector("#total-count").textContent = summary.total;
    document.querySelector("#day-count").textContent = summary.last24Hours;
    document.querySelector("#latest-test").textContent = formatUtc(summary.latestTimestamp);
}

async function loadLogs() {
    setRow("Loading protected records…", "loading-row");
    const params = new URLSearchParams({ page: String(state.page), limit: "10" });
    if (state.query) params.set("query", state.query);

    try {
        const response = await fetch(`/admin/api/logs?${params}`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error("Protected records could not be loaded.");
        const payload = await response.json();
        state.page = payload.pagination.page;
        state.totalPages = payload.pagination.totalPages;
        renderLogs(payload.logs);
        renderSummary(payload.summary);
        status.textContent = `Page ${state.page} of ${state.totalPages} · ${payload.pagination.total} retained record${payload.pagination.total === 1 ? "" : "s"}`;
        previous.disabled = state.page <= 1;
        next.disabled = state.page >= state.totalPages;
    } catch (error) {
        setRow(error.message, "error-row");
        status.textContent = "Unable to load records.";
        previous.disabled = true;
        next.disabled = true;
    }
}

let searchTimer;
search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
        state.query = search.value.trim();
        state.page = 1;
        loadLogs();
    }, 250);
});

previous.addEventListener("click", () => {
    if (state.page > 1) {
        state.page -= 1;
        loadLogs();
    }
});

next.addEventListener("click", () => {
    if (state.page < state.totalPages) {
        state.page += 1;
        loadLogs();
    }
});

clearLogs.addEventListener("click", async () => {
    const approved = window.confirm("Delete every retained authorized test log? This cannot be undone.");
    if (!approved) return;

    clearLogs.disabled = true;
    actionStatus.textContent = "Deleting retained logs…";
    try {
        const response = await fetch("/admin/api/logs", {
            method: "DELETE",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ confirm: "DELETE_ALL_LOGS" })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Logs could not be deleted.");
        actionStatus.textContent = `${payload.deleted} retained log${payload.deleted === 1 ? " was" : "s were"} deleted.`;
        state.page = 1;
        loadLogs();
    } catch (error) {
        actionStatus.textContent = error.message || "Logs could not be deleted.";
    } finally {
        clearLogs.disabled = false;
    }
});

loadLogs();
