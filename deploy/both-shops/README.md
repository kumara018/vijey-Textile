# Both shops on one machine

Use this only if you cannot get two virtual machines. **Two VMs is the better
arrangement** — the shops then fail independently, and each repo's own
`deploy/` folder already does that with no extra steps.

The reason this exists: Oracle's Always Free ARM capacity is frequently
unavailable in popular regions, and securing one instance is markedly easier
than two. The two per-shop stacks cannot simply both be started on one machine
— they each bind ports 80 and 443, so the second Caddy fails. This replaces
them with one Caddy in front of two API containers.

## What is shared, and what is not

**Shared:** the machine, and the certificate manager.

**Not shared:** each shop keeps its own environment file, its own database, its
own image and its own nightly backup directory. Neither shop can read the
other's data, and a bad deploy of one does not touch the other's containers.

**The honest trade:** one machine means one power switch. If it dies, both
shops are down together. That is the cost of using a single instance, and it
is why two VMs is preferred when capacity allows.

## Setup

Clone both repositories **as siblings**:

```bash
cd ~
git clone https://github.com/kumara018/vijey-Textile.git
git clone https://github.com/kumara018/ammalu-tex.git
cd vijey-Textile/deploy/both-shops
```

The build paths depend on that layout — `../../backend` and
`../../../ammalu-tex/backend`.

Point **both** subdomains at this machine's public IP before starting, or the
certificate for whichever name does not resolve will fail to issue:

```
api.vijeytextile.com   ->  <VM public IP>
api.ammalutex.com      ->  <VM public IP>
```

Then:

```bash
cp .env.vijey.example  .env.vijey    && nano .env.vijey
cp .env.ammalu.example .env.ammalu   && nano .env.ammalu
docker compose up -d
```

Each file needs that shop's **own** `DATABASE_URL`, `SECRET_KEY`, Razorpay keys
and Cloudinary credentials. Do not reuse one shop's values in the other —
`startup_checks.py` will not catch that, because both would be individually
valid.

## Check it

```bash
docker compose ps
curl https://api.vijeytextile.com/health
curl https://api.ammalutex.com/health
```

Then point each frontend at its API: in Vercel, set `NEXT_PUBLIC_API_URL` on
each project and redeploy.

## Day to day

```bash
docker compose logs -f vijey-api        # one shop's logs
docker compose restart ammalu-api       # restart one without touching the other
cd ~/vijey-Textile && git pull && cd deploy/both-shops && docker compose up -d --build vijey-api
```

Backups land in `./backups/vijey/` and `./backups/ammalu/`, nightly, fourteen
kept. **Copy them off this machine periodically** — a backup on the same disk
survives a bad deploy or a dropped table, not a lost machine, and with one VM
that machine is now carrying both shops.
