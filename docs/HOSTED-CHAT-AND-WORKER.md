# Hosted Chat and Worker Readiness

**Status:** local implementation only. No Cloudflare account was connected, no Neon migration was applied, no provider key was used, and nothing was deployed. The production composer remains disabled until a real model/runtime endpoint is configured.

## What Cloudflare Free can do

Cloudflare Workers Free is suitable for a lightweight API/control plane: up to **100,000 Worker requests per day**, **10 ms CPU per invocation**, and **128 MB per isolate**. Waiting on a network call does not count against CPU, so a Worker can make a bounded provider API request; it cannot silently become a persistent server process. Free Queues include **10,000 operations per day** and retain messages for **24 hours**. Hyperdrive is included on Free, supports Neon Postgres through `pg` (8.16.3 or newer), and the published Free quota is **100,000 database statements per day**. Cloudflare Durable Objects also have Free allowances and can coordinate per-user/session state.

Cloudflare Cron Triggers are available for scheduled handlers (Free accounts allow up to five triggers). They are a way to schedule bounded jobs—not a way to keep a Worker or container permanently warm. Cron and Queue invocations have a 15-minute wall-clock limit, while Free CPU remains 10 ms. `cron-job.org` is not needed for Cloudflare scheduling and cannot extend those platform limits.

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/), [Queues limits](https://developers.cloudflare.com/queues/platform/limits/), [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/), [Hyperdrive pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/), [Hyperdrive + Neon](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/neon/).

## Why Free Workers cannot run the OpenCode CLI

A Cloudflare Worker runs in a V8 isolate, not a Linux server. The Node `child_process` module is exposed only as a non-functional compatibility stub, so a Free Worker cannot spawn the OpenCode executable or run shell/build/test commands. The OpenCode CLI therefore cannot be embedded as a working coding agent in Workers Free.

Cloudflare Containers can provide a Linux-like filesystem and run existing container images, but containers are available on **Workers Paid**, whose minimum account charge is **$5/month**. That includes limited container usage—25 GiB-hours of memory, 375 vCPU-minutes and 200 GB-hours of disk per month; usage beyond those allotments is billed. A container/sandbox integration can be kept explicitly feature-gated, but it cannot be activated on Free or represented as free always-on execution.

Sources: [Node.js compatibility and non-functional stubs](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [Containers overview](https://developers.cloudflare.com/containers/), [Containers pricing](https://developers.cloudflare.com/containers/platform/pricing/).

## Honest Free-tier architecture

1. Keep the existing Vercel frontend and add a separate Cloudflare Free Worker for authenticated API/control-plane work, capability reporting and job submission.
2. Use Cloudflare Queues to deliver only small job identifiers; persist owner-scoped job state and encrypted prompts/results in Neon through Hyperdrive (or use SQLite-backed Durable Objects for the state that belongs there). Never put raw prompts, provider keys or result text in queue messages.
3. Keep execution disabled on the Free plan. When explicitly authorized and available, a Workers Paid Container can run the pinned OpenCode Linux CLI in an isolated, short-lived environment. The current V1 Atlas SDK cannot be assumed compatible with OpenCode V2; the V2 API migration and pinned artifact verification must be completed first.
4. A separate lighter option is real OpenAI chat-only requests through a Worker using a user-provided API key. That would bill the user’s OpenAI account and would not run project tools, shell commands, builds or tests. No key collection flow is enabled until its storage and billing choice are agreed.

The local Postgres queue and AES-256-GCM envelope are foundational pieces for this design, not a live service. Expired worker leases become interrupted rather than being automatically replayed, so Atlas does not repeat a potentially billable provider request without the user’s knowledge.

## Clyvro and Vercel security

`clyvro.vercel.app` is separate from Atlas’s current `atlascody.vercel.app` deployment. The server-only Clyvro client is optional and makes no request without a key. Clyvro Site Guard/security scans are not active; Clyvro requires an eligible Pro/Agency API key, and scan requests must remain consent-gated and restricted to operator-verified hostnames. No key or hostname allowlist was supplied.

Atlas’s Vercel config now adds HSTS, `X-Frame-Options: DENY`, and a restrictive Permissions Policy alongside existing no-sniff and no-referrer headers. A Content Security Policy is not included yet because the production Neon Auth origin must be known and tested first. Vercel Deployment Protection is a separate dashboard setting: Standard Protection covers previews, while protecting production would make the public app private. No Vercel setting was changed.

Sources: [Clyvro API docs](https://clyvro.vercel.app/docs/api), [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection).

## Still needed before live messaging or code execution

- A Cloudflare account, its exact Atlas frontend origin, and authorization to create the Free Worker, Queue, and any Durable Object/Hyperdrive bindings. A least-privilege Neon development branch/role is needed before applying the queue migration.
- For coding tasks, explicit approval for Workers Paid and container usage, plus confirmation that Containers are available in the user’s Cloudflare account. No paid resource has been provisioned.
- A choice between per-user OpenAI BYOK (users pay OpenAI directly) and a platform-managed OpenAI key with explicit budget/rate limits. No OpenAI provider key has been used.
- For Clyvro, an eligible API key and the exact verified domains to protect or scan.
- Validate Neon Auth issuer, audience, JWKS and browser token flow before enabling owner-authenticated queue routes. Until then, no message route accepts work and no sample response is generated.
