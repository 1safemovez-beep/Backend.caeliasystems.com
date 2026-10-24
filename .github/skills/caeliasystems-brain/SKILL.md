---
name: caeliasystems-brain
description: Integrate Caelia's Brain with the Motherboard backend without guessing service contracts or weakening security boundaries.
---
# Caelia Systems Brain Integration

## Purpose
Guide changes that connect Caelia's Brain service to the Motherboard backend and dashboard.

## When to use
- Wiring or troubleshooting the Brain-to-backend chat integration
- Updating the Motherboard's backend API configuration
- Reviewing Brain-related environment, routing, or CORS changes

## Integration workflow
1. Read `CAELIA_COPILOT_MASTER_INSTRUCTIONS (1).md` and `CLOUDFLARE-ROUTING.md` first.
2. Inspect the exact runtime being deployed. The Docker startup extracts `CAELIA-BACKEND-SAVE.zip`; do not assume root-level files match the archived application.
3. Confirm the Brain service's deployed base URL, authentication requirements, request schema, and response schema before changing the integration. Do not invent a URL or API contract.
4. Keep the domains separate:
   - Public site: `https://caeliasystems.com`
   - Motherboard dashboard: `https://motherboard.caeliasystems.com`
   - Backend API: `https://backend.caeliasystems.com`
5. Keep the dashboard pointed at `https://backend.caeliasystems.com/api`. Set `DASHBOARD_ORIGIN=https://motherboard.caeliasystems.com` in the backend deployment environment.
6. Keep Brain credentials and all other secrets server-side in the approved secret store or backend environment. Never expose them to the dashboard, commit them, or log them.
7. Preserve owner authentication on `/api/*`. Keep `/health` public and do not expose Brain service credentials through status or readiness responses.
8. Preserve honest disconnected behavior. When `CAELIA_BRAIN_URL` is unset, chat must report that the Brain is not connected rather than fabricating a reply.
9. Update API documentation and test both the disconnected response and the confirmed connected contract. Do not claim the remote Brain or Cloudflare deployment was verified unless it was actually tested.

## Current backend contract
- Dashboard chat calls authenticated `POST /api/chat` with `{ "message": "..." }`.
- The backend forwards to `POST ${CAELIA_BRAIN_URL}/chat` with JSON `{ "message": "..." }`.
- The backend returns `brainConnected: false` when `CAELIA_BRAIN_URL` is empty.
- The Brain URL is not currently supplied in `.env.example`; deployment must provide the confirmed URL.

## Review checklist
- [ ] Brain URL and request/response/auth contract were confirmed from an authoritative source.
- [ ] Changes target the code actually used by Docker/Railway.
- [ ] Dashboard CORS and API base URL use the canonical domains above.
- [ ] Secrets remain server-side and are not logged or returned.
- [ ] Existing owner authentication and honest disconnected behavior remain intact.
- [ ] Local validation is distinguished from deployed integration verification.
