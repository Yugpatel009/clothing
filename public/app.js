"use strict";

const form = document.querySelector("#test-form");
const consent = document.querySelector("#consent");
const button = document.querySelector("#start-button");
const status = document.querySelector("#form-status");

if (form && consent && button && status) {
    button.disabled = !consent.checked;

    consent.addEventListener("change", () => {
        button.disabled = !consent.checked;
        status.textContent = "";
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!consent.checked) return;

        button.disabled = true;
        button.classList.add("is-loading");
        status.textContent = "Sending your authorized test request…";

        try {
            const response = await fetch("/test", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Accept": "application/json" },
                body: JSON.stringify({ consent: true })
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || "The test could not be completed.");
            }

            status.textContent = "Test received. Opening the confirmation page…";
            window.location.assign(payload.redirect || "/results");
        } catch (error) {
            status.textContent = error.message || "A network error prevented the test from being sent.";
            button.disabled = false;
            button.classList.remove("is-loading");
        }
    });
}
