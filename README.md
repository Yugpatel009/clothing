# TraceIP

TraceIP is a small, consent-based cybersecurity education lab. It shows the limited network address a web server receives when a visitor explicitly authorizes a test. It is for authorized devices, networks, and classroom/lab environments only.

## What the lab records

After the visitor checks the consent box and starts a test, the server stores exactly these fields:

- `ip`: the address visible to this server for that request
- `timestamp`: the request time in UTC (ISO 8601)
- `event`: always `authorized_ip_test`

It does **not** collect passwords, cookies, browser or device fingerprints, GPS data, location lookups, or form data. It does not try to bypass a VPN, proxy, firewall, or other privacy control. The public confirmation page intentionally never displays the visitor's IP address.

Records live only in `data/logs.json`, which is not publicly served and is ignored by Git. The default retention period is seven days; expired records are removed whenever the server starts or the protected dashboard is used. An authenticated administrator can delete all records immediately.

## Requirements

- Node.js 18 or newer
- npm

## Setup and run locally

1. Install dependencies:

   ```powershell
   npm.cmd install
   ```

2. Copy the example configuration and set a strong, unique dashboard password:

   ```powershell
   Copy-Item .env.example .env
   ```

   Edit `.env` and replace `ADMIN_PASSWORD=replace-with-a-long-unique-password`.

3. Start the application:

   ```powershell
   npm.cmd start
   ```

4. Open the consent page at [http://localhost:3000](http://localhost:3000). Open [http://localhost:3000/admin](http://localhost:3000/admin) to access the dashboard; the browser will ask for the `ADMIN_USER` and `ADMIN_PASSWORD` from `.env`.

Admin access stays disabled until a non-empty `ADMIN_PASSWORD` is configured. Basic authentication must only be used over HTTPS outside a local lab.

## Configuration

The app reads environment variables and, for convenience in local development, loads a local `.env` file without overriding variables already set by the host.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP listening port. |
| `ADMIN_USER` | `traceip-admin` | Dashboard username. |
| `ADMIN_PASSWORD` | none | Required dashboard password; do not commit it. |
| `LOG_RETENTION_DAYS` | `7` | Log retention window, from 1 to 90 days. |
| `TRUST_PROXY` | `false` | Whether to use the address supplied by an explicitly trusted reverse proxy. |
| `NODE_ENV` | `development` | Set to `production` only behind HTTPS; this enables HSTS. |
| `LOG_FILE` | `data/logs.json` | Optional protected log-file location. |

`TRUST_PROXY` is deliberately `false` by default. With that setting, TraceIP records the direct network peer address from the socket and ignores forwarded-IP headers. Set it to `true` only when the application is behind a reverse proxy you operate and have configured to remove client-supplied forwarding headers and add its own trusted value.

## Local testing from devices on the same Wi-Fi

The server listens on all local interfaces. Find this computer's Wi-Fi IPv4 address:

```powershell
ipconfig
```

On another device connected to the **same trusted Wi-Fi**, visit `http://YOUR_COMPUTER_IPV4:3000`, for example `http://192.168.1.20:3000`. The visitor must read the notice and actively check the consent box before the app records an address.

If the other device cannot connect, check that Windows Defender Firewall allows inbound TCP traffic on port 3000 for the current **Private** network only. Do not expose this local HTTP server to the public internet. On a same-Wi-Fi test, the recorded address may be the device's local/private address rather than a public internet address.

## HTTPS deployment

1. Choose a Node.js host or reverse proxy that terminates TLS and provides a valid HTTPS certificate.
2. Set `NODE_ENV=production`, `ADMIN_USER`, a strong `ADMIN_PASSWORD`, and a short `LOG_RETENTION_DAYS` in the host's secret/environment-variable manager. Never commit `.env`.
3. Configure the platform to run `npm start` and route HTTPS traffic to the app's `PORT`.
4. Confirm that HTTP requests redirect to HTTPS at the hosting or proxy layer before placing the lab online. The app enables HSTS only when `NODE_ENV=production`.
5. Leave `TRUST_PROXY=false` unless the proxy is explicitly trusted and sanitizes forwarded headers. If it is not safe to enable proxy trust, the application will log the proxy connection instead—which is preferable to accepting spoofed client-IP headers.
6. Restrict `/admin` to authorized staff and protect the server filesystem so that `data/logs.json` cannot be downloaded or read by other accounts.

Before a public deployment, review your jurisdiction's privacy and retention requirements. An IP address can be personal data under some laws.

## Understanding IP addresses

- **Public IP address:** The address a network presents to the public internet. It can be shared by many people or devices.
- **Private/local IP address:** Addresses such as `192.168.x.x`, `10.x.x.x`, or `172.16.x.x` used inside a local network. A same-LAN lab may observe one of these.
- **NAT:** Network Address Translation lets many local devices share a single outward-facing public address. A server seeing that address cannot determine which individual device behind the NAT made the request.
- **VPN:** A VPN can cause the server to see a VPN provider's exit address instead of the user's usual public address. TraceIP does not circumvent it.
- **Proxy:** A proxy can similarly relay a request, so the server may see the proxy address. Forwarded headers are ignored unless `TRUST_PROXY=true` is intentionally configured.
- **Geolocation limits:** IP geolocation is an estimate, often at city/region or network level. It is not GPS, cannot reliably identify a person, and should not be used for sensitive decisions.

## Security controls

- Explicit frontend and server-side consent requirement before a test is logged
- IP, UTC timestamp, and event name only; no public log endpoint
- Password-protected dashboard using timing-safe credential comparison
- No-store responses for authenticated dashboard pages and APIs
- Content Security Policy, frame protection, referrer policy, permissions policy, MIME-sniffing protection, and production HSTS
- In-memory request rate limits for the public app and a stricter limit for `/admin`
- Small JSON request body limit and bounded query inputs
- Atomic local log writes, retention cleanup, and explicit bulk deletion confirmation

This is a teaching/lab implementation, not a replacement for a centralized production audit system. For multi-instance deployment, use a protected database with access controls, encryption, auditing, and organization-appropriate retention policies.

## Tests

Run the route and access-control tests with:

```powershell
npm.cmd test
```

The tests verify the consent gate, security headers, protected log access, no-store dashboard responses, public results privacy, and confirmed authenticated deletion. If your PowerShell policy permits `npm`, the equivalent commands work; `npm.cmd` avoids Windows PowerShell script-policy restrictions.
