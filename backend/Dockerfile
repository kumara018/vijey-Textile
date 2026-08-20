# The API, as a container — so the host is a choice rather than a lock-in.
#
# WHY THIS EXISTS. The free Render workspace suspends every service once the
# workspace's 750 monthly instance-hours are used, and those hours are shared
# across ALL services rather than granted per service. Three services running
# continuously exhaust the cap in about ten days, which is what took both shops
# offline. Paying was blocked too: the Starter tier was not offered and the
# plan change returned "Service Unavailable".
#
# The app itself has no reason to be tied to any of that. It is stateless — the
# database is external (Neon), media is on Cloudinary, and the only local state
# is the process. So the fix that actually removes the risk is to make it
# deployable anywhere in one command, which is what a Dockerfile buys.
#
# This image runs unchanged on Fly.io, Google Cloud Run, Koyeb, Railway,
# Hugging Face Spaces, a VPS, or back on Render. Nothing in it is
# host-specific: it reads $PORT, which every one of them sets.
#
#     docker build -t vijey-api ./backend
#     docker run -p 8000:8000 -e DATABASE_URL="postgresql://…" vijey-api
#
# The Python version is pinned to runtime.txt's 3.11.9 so the container matches
# what production has been running, rather than silently moving to whatever
# "latest" means on the day it is built.

FROM python:3.11.9-slim

# psycopg2-binary ships wheels, but Pillow and cryptography can still need a
# compiler on slim. Installed and removed in one layer so they are not carried
# in the final image.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Requirements first, and alone: this layer is cached and only rebuilt when the
# dependency list changes, so ordinary code edits do not reinstall everything.
COPY requirements.txt .
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && pip install --upgrade pip \
    && pip install -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY . .

# Run as a non-root user. If the container is ever compromised, the blast
# radius should not include the filesystem it is running on.
RUN useradd --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

# $PORT is set by every host this is meant to run on; 8000 is the local default.
ENV PORT=8000
EXPOSE 8000

# The same command Render was given, so behaviour does not change with the host.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
