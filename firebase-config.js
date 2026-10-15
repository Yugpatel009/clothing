/**
 * Firebase Configuration and Storage Manager for TraceIP
 * 
 * 1. Create a free project at https://console.firebase.google.com
 * 2. Create a "Firestore Database" in test mode or with read/write access to "ip_logs"
 * 3. Add a Web App in your Firebase project and paste your keys below:
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    deleteDoc,
    doc,
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// REPLACE THESE WITH YOUR FIREBASE PROJECT CONFIG
export const firebaseConfig = {
    apiKey: "AIzaSyC5j-IpFy2MIbjBoO5gRuXi3V947SOARlM",
    authDomain: "chatot-fb2d1.firebaseapp.com",
    projectId: "chatot-fb2d1",
    storageBucket: "chatot-fb2d1.firebasestorage.app",
    messagingSenderId: "478539955282",
    appId: "1:478539955282:web:1e8265906a763bc4f7338b",
    measurementId: "G-M8BKMG4J74"
};

// Admin dashboard access password (change to your own secure password)
export const ADMIN_PASSWORD = "admin";

export function isFirebaseConfigured() {
    return firebaseConfig.apiKey &&
        firebaseConfig.apiKey !== "YOUR_API_KEY" &&
        firebaseConfig.projectId !== "YOUR_PROJECT_ID";
}

let db = null;
if (isFirebaseConfigured()) {
    try {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
    } catch (e) {
        console.error("Firebase initialization failed:", e);
    }
}

const LOCAL_STORAGE_KEY = "traceip_fallback_logs";

function getLocalLogs() {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

function saveLocalLogs(logs) {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(logs));
    } catch (e) {
        console.error("Failed to save to local storage:", e);
    }
}

/**
 * Save an IP test log to Firestore (or local fallback)
 */
export async function saveLogRecord({
    ip,
    ipv4,
    ipv6,
    networkType,
    deviceId,
    location,
    connection,
    device,
    customName,
    event = "authorized_ip_test"
}) {
    const timestamp = new Date().toISOString();
    const finalIpv4 = ipv4 || (ip && !ip.includes(":") ? ip : null);
    const finalIpv6 = ipv6 || (ip && ip.includes(":") ? ip : null);
    const finalNetworkType = networkType || (
        finalIpv4 && finalIpv6 ? "Dual-Stack (IPv4 + IPv6)" :
        finalIpv6 ? "IPv6 Only" :
        finalIpv4 ? "IPv4 Only" : "Unknown"
    );

    const record = {
        deviceId: deviceId || device?.deviceId || "DEV-UNKNOWN",
        ip: ip || finalIpv6 || finalIpv4 || "Unknown IP",
        ipv4: finalIpv4,
        ipv6: finalIpv6,
        networkType: finalNetworkType,
        location: {
            city: location?.city || "Unknown City",
            region: location?.region || "",
            country: location?.country || "Unknown Country",
            countryCode: location?.countryCode || "",
            flag: location?.flag || "🌐",
            isp: location?.isp || "Unknown ISP",
            org: location?.org || "",
            asn: location?.asn || "",
            timezone: location?.timezone || ""
        },
        connection: {
            type: connection?.type || "Unknown",
            downlink: connection?.downlink || null,
            rtt: connection?.rtt || null
        },
        timestamp,
        event,
        device: {
            deviceId: deviceId || device?.deviceId || "DEV-UNKNOWN",
            summary: device?.summary || "Unknown Device",
            model: device?.model || "Unknown",
            type: device?.type || "Desktop",
            os: device?.os || "Unknown",
            browser: device?.browser || "Unknown",
            screen: device?.screen || "Unknown",
            gpu: device?.gpu || "Standard GPU",
            cpu: device?.cpu || "Unknown",
            memory: device?.memory || "Unknown",
            touch: device?.touch || "Unknown",
            timezone: device?.timezone || "Unknown",
            language: device?.language || "Unknown",
            customName: customName ? customName.trim() : null
        }
    };

    if (db) {
        const docRef = await addDoc(collection(db, "ip_logs"), {
            ...record,
            createdAt: serverTimestamp()
        });
        return { id: docRef.id, ...record, storage: "firebase" };
    } else {
        const localLogs = getLocalLogs();
        const id = "local-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
        const saved = { id, ...record, storage: "local" };
        localLogs.unshift(saved);
        saveLocalLogs(localLogs);
        return saved;
    }
}

/**
 * Fetch all stored logs
 */
export async function fetchLogs(maxCount = 200) {
    if (db) {
        try {
            const q = query(collection(db, "ip_logs"), orderBy("createdAt", "desc"), limit(maxCount));
            const querySnapshot = await getDocs(q);
            const logs = [];
            querySnapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const v4 = data.ipv4 || (data.ip && !data.ip.includes(":") ? data.ip : null);
                const v6 = data.ipv6 || (data.ip && data.ip.includes(":") ? data.ip : null);
                const netType = data.networkType || (v4 && v6 ? "Dual-Stack (IPv4 + IPv6)" : v6 ? "IPv6 Only" : "IPv4 Only");
                logs.push({
                    id: docSnap.id,
                    deviceId: data.deviceId || data.device?.deviceId || "DEV-LEGACY",
                    ip: data.ip,
                    ipv4: v4,
                    ipv6: v6,
                    networkType: netType,
                    location: data.location || {
                        city: "Unknown City",
                        country: "Unknown Country",
                        isp: "Unknown ISP",
                        flag: "🌐"
                    },
                    connection: data.connection || { type: "Unknown" },
                    timestamp: data.timestamp || (data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString()),
                    event: data.event,
                    device: data.device || {},
                    storage: "firebase"
                });
            });
            return logs;
        } catch (err) {
            console.error("Failed to read from Firestore:", err);
            // Fallback to local
            return getLocalLogs();
        }
    } else {
        return getLocalLogs();
    }
}

/**
 * Delete a single log record by ID
 */
export async function deleteSingleLog(id) {
    if (db && !id.startsWith("local-")) {
        await deleteDoc(doc(db, "ip_logs", id));
    } else {
        const logs = getLocalLogs().filter((l) => l.id !== id);
        saveLocalLogs(logs);
    }
}

/**
 * Clear all logs
 */
export async function clearAllRecords() {
    if (db) {
        const querySnapshot = await getDocs(collection(db, "ip_logs"));
        const batch = writeBatch(db);
        querySnapshot.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });
        await batch.commit();
    }
    saveLocalLogs([]);
}
