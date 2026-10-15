/**
 * Device Detector for TraceIP
 * Extracts operating system, browser, device model, type, GPU, hardware info, and persistent device ID.
 */

export function getOrCreateDeviceId() {
    try {
        if (typeof localStorage !== "undefined" && localStorage.getItem) {
            let id = localStorage.getItem("traceip_device_uid");
            if (!id) {
                id = "DEV-" + Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
                localStorage.setItem("traceip_device_uid", id);
            }
            return id;
        }
    } catch {
        // Fallback if localStorage is restricted
    }
    return "DEV-" + Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export function getGpuRenderer() {
    try {
        if (typeof document !== "undefined" && document.createElement) {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (gl) {
                const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
                if (debugInfo) {
                    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    if (renderer) {
                        const clean = renderer.replace(/^ANGLE \([^,]+,\s*/i, "").replace(/,\s*D3D.*$/i, "").replace(/\)$/, "").trim();
                        return clean || renderer;
                    }
                }
            }
        }
    } catch {
        // Fallback
    }
    return "Standard GPU";
}

export function detectDevice(customUa, customPlatform) {
    const ua = customUa || (typeof navigator !== "undefined" ? navigator.userAgent : "") || "";
    const platform = customPlatform || (typeof navigator !== "undefined" ? navigator.platform : "") || "";
    let os = "Unknown OS";
    let deviceModel = "Desktop PC";
    let deviceType = "Desktop";
    let browser = "Unknown Browser";

    // 1. Detect Device Type & Model
    if (/iPad|tablet|PlayBook/i.test(ua)) {
        deviceType = "Tablet";
        deviceModel = "Apple iPad";
    } else if (/iPhone/i.test(ua)) {
        deviceType = "Mobile";
        deviceModel = "Apple iPhone";
    } else if (/iPod/i.test(ua)) {
        deviceType = "Mobile";
        deviceModel = "Apple iPod";
    } else if (/Android/i.test(ua)) {
        if (/Mobile/i.test(ua)) {
            deviceType = "Mobile";
        } else {
            deviceType = "Tablet";
        }
        // Extract Android device model if present (e.g., "SM-G998B", "Pixel 7")
        const match = ua.match(/Android[^;]+;\s*([^;)]+)\s*Build/i) || ua.match(/Android[^;]+;\s*([^;)]+)\)/i);
        if (match && match[1]) {
            deviceModel = match[1].trim();
        } else {
            deviceModel = "Android Device";
        }
    } else if (/Macintosh|MacIntel|MacPPC|Mac68K/i.test(platform) || /Mac OS X/i.test(ua)) {
        deviceType = "Desktop";
        deviceModel = "Apple Mac";
    } else if (/Win32|Win64|Windows|WinCE/i.test(platform) || /Windows/i.test(ua)) {
        deviceType = "Desktop";
        deviceModel = "Windows PC";
    } else if (/Linux/i.test(platform) || /Linux/i.test(ua)) {
        deviceType = "Desktop";
        deviceModel = "Linux PC";
    }

    // 2. Detect Operating System with version
    if (/Windows NT 10.0/i.test(ua)) {
        os = "Windows 10 / 11";
    } else if (/Windows NT 6.3/i.test(ua)) {
        os = "Windows 8.1";
    } else if (/Windows NT 6.1/i.test(ua)) {
        os = "Windows 7";
    } else if (/Mac OS X ([\d._]+)/i.test(ua)) {
        const v = ua.match(/Mac OS X ([\d._]+)/i)[1].replace(/_/g, ".");
        os = `macOS ${v}`;
    } else if (/Android ([\d.]+)/i.test(ua)) {
        const v = ua.match(/Android ([\d.]+)/i)[1];
        os = `Android ${v}`;
    } else if (/OS ([\d._]+)/i.test(ua) && /iPhone|iPad|iPod/i.test(ua)) {
        const v = ua.match(/OS ([\d._]+)/i)[1].replace(/_/g, ".");
        os = `iOS ${v}`;
    } else if (/CrOS/i.test(ua)) {
        os = "ChromeOS";
    } else if (/Linux/i.test(ua)) {
        os = "Linux";
    }

    // 3. Detect Browser with version
    if (/Edg\/(\d+)/i.test(ua)) {
        const v = ua.match(/Edg\/(\d+)/i)[1];
        browser = `Microsoft Edge ${v}`;
    } else if (/OPR\/(\d+)/i.test(ua) || /Opera\/(\d+)/i.test(ua)) {
        const v = (ua.match(/OPR\/(\d+)/i) || ua.match(/Opera\/(\d+)/i))[1];
        browser = `Opera ${v}`;
    } else if (/Brave/i.test(ua) || (typeof navigator !== "undefined" && navigator.brave && typeof navigator.brave.isBrave === "function")) {
        browser = "Brave";
    } else if (/Chrome\/(\d+)/i.test(ua) && !/Chromium/i.test(ua)) {
        const v = ua.match(/Chrome\/(\d+)/i)[1];
        browser = `Google Chrome ${v}`;
    } else if (/Version\/(\d+(\.\d+)?).*Safari/i.test(ua)) {
        const v = ua.match(/Version\/(\d+(\.\d+)?)/i)[1];
        browser = `Apple Safari ${v}`;
    } else if (/Firefox\/(\d+)/i.test(ua)) {
        const v = ua.match(/Firefox\/(\d+)/i)[1];
        browser = `Mozilla Firefox ${v}`;
    }

    // Screen info
    const screenWidth = typeof window !== "undefined" && window.screen ? window.screen.width : 0;
    const screenHeight = typeof window !== "undefined" && window.screen ? window.screen.height : 0;
    const screenResolution = `${screenWidth}x${screenHeight}`;
    const language = typeof navigator !== "undefined" && navigator.language ? navigator.language : "Unknown";

    // Hardware Telemetry
    const cpu = typeof navigator !== "undefined" && navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} Cores` : "Unknown";
    const memory = typeof navigator !== "undefined" && navigator.deviceMemory ? `${navigator.deviceMemory} GB RAM` : "Unknown";
    const touch = typeof navigator !== "undefined" && typeof navigator.maxTouchPoints === "number" ? (navigator.maxTouchPoints > 0 ? `${navigator.maxTouchPoints} Touch` : "No Touch") : "Unknown";
    const timezone = typeof Intl !== "undefined" && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Unknown";

    // Construct human-readable summary
    const summary = `${deviceModel} · ${os} · ${browser}`;

    return {
        deviceId: getOrCreateDeviceId(),
        summary,
        model: deviceModel,
        type: deviceType,
        os,
        browser,
        screen: screenResolution,
        gpu: getGpuRenderer(),
        cpu,
        memory,
        touch,
        timezone,
        language,
        userAgent: ua
    };
}
