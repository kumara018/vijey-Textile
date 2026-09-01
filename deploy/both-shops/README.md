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
./status.sh                             # what is running, since when, is it current
./deploy.sh vijey                       # pull, rebuild, wait for healthy (or: ammalu | both)
docker compose logs -f vijey-api        # one shop's logs
docker compose restart ammalu-api       # restart one without touching the other
```

**Changing a value in an env file needs `up -d`, not `restart`.** Environment
values are baked in when a container is created, so a restart runs the old
process with the old values and looks like it worked:

```bash
docker compose up -d ammalu-api
```

Anything under `frontend/` deploys itself from Vercel and never touches this
machine. `deploy.sh` and `status.sh` are backends only.

## From a different computer

Nothing lives on your laptop except the key. The machine keeps running whether
you are connected or not — these steps restore your *access*, nothing else.

**1. The two things you must not lose.** Neither can be recovered by Oracle or
by anyone else:

| File | What it is |
|---|---|
| `ssh-key-....key` | the only way in |
| `.env.vijey`, `.env.ammalu` | every secret both shops hold |

Keep them in a password manager — not in a repository, not in a synced
documents folder.

**2. Put the key on the new machine** and lock its permissions, or OpenSSH will
refuse to use it:

```bash
mkdir -p ~/.ssh && cp /path/to/ssh-key-....key ~/.ssh/shops.key && chmod 600 ~/.ssh/shops.key
```

On Windows:

```powershell
icacls $HOME\.ssh\shops.key /inheritance:r /grant:r "$($env:USERNAME):(R)"
```

**3. Give it a name** in `~/.ssh/config`, so the path is typed once and never
again:

```
Host shops
    HostName 92.4.88.89
    User ubuntu
    IdentityFile ~/.ssh/shops.key
```

Windows Notepad silently appends `.txt` to a file saved without an extension,
and SSH then ignores it without saying so. Check with `ls ~/.ssh`: the file must
be named exactly `config`.

**4. That is all.**

```bash
ssh shops
cd ~/vijey-Textile/deploy/both-shops && ./status.sh
```

Both repositories, Docker, the containers and the certificates are already on
the machine. You clone nothing, install nothing, and copy no env file — those
live on the server, not on you. Deploying is unchanged:

```bash
./deploy.sh both
```

**If the key is lost** you cannot get back in, and Oracle cannot let you in.
Rebuild instead: launch an instance, install Docker, clone both repositories as
siblings, put the two env files in `deploy/both-shops/`, `docker compose up -d`,
then repoint the two A records. The data is untouched throughout — it lives in
Neon, not on this machine. About thirty minutes, which is the entire reason the
env files are worth keeping.

Backups land in `./backups/vijey/` and `./backups/ammalu/`, nightly, fourteen
kept. **Copy them off this machine periodically** — a backup on the same disk
survives a bad deploy or a dropped table, not a lost machine, and with one VM
that machine is now carrying both shops.
