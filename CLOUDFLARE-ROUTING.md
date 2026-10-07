# Caelia / Cloudflare routing

## Canonical URLs

- Caelia public site: `https://caeliasystems.com`
- Motherboard: `https://motherboard.caeliasystems.com`
- Backend API: `https://backend.caeliasystems.com`

## Important separation

`caeliasystems.com` belongs to Caelia. It must **not** redirect to the Motherboard.
`motherboard.caeliasystems.com` is the Motherboard dashboard.
`backend.caeliasystems.com` is the private backend/API origin.

## DNS

Create `backend.caeliasystems.com` as a DNS CNAME (preferred) to the hostname supplied by the always-on backend host. If the backend host provides a fixed public IP instead, use an A record. Keep Cloudflare proxy enabled when compatible with the backend host.

## Backend environment

Set:

- `BACKEND_PUBLIC_URL=https://backend.caeliasystems.com`
- `CANONICAL_DASHBOARD_URL=https://motherboard.caeliasystems.com`
- `DASHBOARD_ORIGIN=https://motherboard.caeliasystems.com`

Keep `OWNER_TOKEN`, Discord token, database credentials, encryption keys, and other secrets in the backend host's environment/secret store. Never put them in DNS records, frontend JavaScript, or the repository.

## Cloudflare redirect rules

Do **not** create an apex-to-Motherboard redirect from `caeliasystems.com`; that domain is Caelia's public site. Any future Caelia-to-Motherboard navigation should be an intentional application link, not a DNS/Cloudflare redirect.
