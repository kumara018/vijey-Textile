# Deploying the backend to Oracle Cloud Always Free

Two containers on one always-free virtual machine: the API, and Caddy in front
of it for automatic HTTPS. Nothing here has an hour cap or a trial clock.

> **Only got one VM?** Oracle's ARM capacity is often unavailable and one
> instance is easier to secure than two. This stack binds ports 80 and 443, so
> two copies cannot share a machine — use `both-shops/` instead, which puts one
> Caddy in front of both APIs. Two VMs is still preferable when you can get them.

**Docker and Oracle are not alternatives.** Docker packages the app; Oracle is
the machine it runs on. The Dockerfile runs *on* Oracle.

---

## Before you start

- An Oracle Cloud account (the Always Free tier needs a card for identity
  verification but **cannot** charge you — Always Free resources stay free)
- A database on Neon, and its connection string
- A subdomain to point at the machine, e.g. `api.vijeytextile.com`

---

## 1. Create the machine

Oracle Cloud console → Compute → Instances → Create.

- **Image**: Ubuntu 22.04
- **Shape**: `VM.Standard.A1.Flex` — the ARM one. Give it 2 cores and 12 GB.
  That is half the Always Free allowance, so both shops fit on separate
  machines, or both stacks fit on one.
- **Networking**: create a public IP.
- Download the SSH private key when offered. It is not shown again.

> If Oracle says the ARM shape is out of capacity in your region, retry over
> the next day or two — it frees up. The x86 `VM.Standard.E2.1.Micro` shape is
> also Always Free and works, just smaller.

**Open the firewall**, which catches most people out. Oracle blocks everything
by default in two places and both must be changed:

```bash
# On the VM
sudo iptables -I INPUT -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

And in the console: VCN → Security List → add Ingress rules for TCP 80 and 443
from `0.0.0.0/0`.

## 2. Point DNS at it

Add an `A` record for `api.vijeytextile.com` pointing to the VM's public IP.

**Do this before step 4.** Caddy asks Let's Encrypt for a certificate on first
start, and that only succeeds once the name resolves to this machine.

## 3. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

## 4. Deploy

```bash
git clone https://github.com/kumara018/vijey-Textile.git
cd vijey-Textile/deploy
cp .env.example .env
nano .env                 # fill in every value
docker compose up -d
```

`startup_checks.py` refuses to boot if `SECRET_KEY` or `ADMIN_PASSWORD` is
missing or still the repository placeholder, so a mistake here fails in the
deploy log rather than silently in a customer's account.

Check it:

```bash
docker compose logs -f api
curl https://api.vijeytextile.com/health     # {"status":"healthy"}
```

## 5. Point the frontend at it

Vercel → project → Settings → Environment Variables →
`NEXT_PUBLIC_API_URL = https://api.vijeytextile.com` → redeploy.

## 6. Turn off what caused the suspension

- Render: delete both services and `parenthelper`
- UptimeRobot: if you keep a monitor, set it to **30 minutes**. A 5-minute
  interval is what kept the free Render instances awake and burned 750 hours
  in ten days. It does not matter on this VM, which is always on anyway — but
  the habit is worth breaking.

---

## Keeping it alive

The stack is built so there is nothing routine to do:

- **Certificates** renew themselves. Caddy handles it.
- **Crashes and reboots** self-recover — `restart: unless-stopped` on both
  containers.
- **Logs are capped** at 10 MB × 3 files each, so they cannot fill the disk.
  An unbounded log is the second most common way a long-running VM dies.

The one thing worth doing occasionally:

```bash
sudo apt update && sudo apt upgrade -y      # security patches, monthly
```

To deploy a code change:

```bash
cd vijey-Textile && git pull
cd deploy && docker compose up -d --build
```

## If something is wrong

```bash
docker compose ps                  # is anything unhealthy?
docker compose logs --tail=100 api
docker compose restart api
```

A certificate that never issues is almost always DNS: confirm
`dig api.vijeytextile.com` returns the VM's IP, then `docker compose restart caddy`.
