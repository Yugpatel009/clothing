"use strict";

function applySecurityHeaders({ isProduction }) {
    return (req, res, next) => {
        res.set({
            "Content-Security-Policy": [
                "default-src 'self'",
                "base-uri 'self'",
                "font-src 'self'",
                "form-action 'self'",
                "frame-ancestors 'none'",
                "img-src 'self' data:",
                "object-src 'none'",
                "script-src 'self'",
                "style-src 'self'"
            ].join("; "),
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Resource-Policy": "same-origin",
            "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY"
        });

        if (isProduction) {
            res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        }

        next();
    };
}

module.exports = { applySecurityHeaders };
