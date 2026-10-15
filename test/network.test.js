"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

function categorizeNetwork(ipv4, ipv6) {
    if (ipv4 && ipv6) return "Dual-Stack (IPv4 + IPv6)";
    if (ipv6) return "IPv6 Only";
    if (ipv4) return "IPv4 Only";
    return "Unknown";
}

test("correctly categorizes Dual-Stack visitors with both IPv4 and IPv6", () => {
    const v4 = "106.194.78.188";
    const v6 = "2405:201:2009:b095:60e9:8a65:213b:a123";
    const result = categorizeNetwork(v4, v6);
    assert.equal(result, "Dual-Stack (IPv4 + IPv6)");
});

test("correctly categorizes IPv4-only visitors when IPv6 is not available", () => {
    const v4 = "106.194.78.188";
    const v6 = null;
    const result = categorizeNetwork(v4, v6);
    assert.equal(result, "IPv4 Only");
});

test("correctly categorizes IPv6-only visitors", () => {
    const v4 = null;
    const v6 = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";
    const result = categorizeNetwork(v4, v6);
    assert.equal(result, "IPv6 Only");
});
