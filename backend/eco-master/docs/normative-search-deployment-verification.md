# Normative Search — Deployment Verification

This document covers verifying a fix to `kz.eco.normative` / `kz.eco.protocol.NormativeReferenceController`
(`GET /api/normatives/search`, `GET /api/normatives/health`) actually reaches a running deployment.

**This document was written and reviewed against source code only.** No Docker/production
environment is reachable from the sandbox that produced it — the steps below must be executed by
someone with access to the real deployment.

## 1. Confirm the build rebuilds from source (not a stale jar)

`Dockerfile` at the repo root is a multi-stage build:

```
FROM maven:3.9-eclipse-temurin-21 AS build
...
COPY pom.xml ./
RUN mvn -B -q -e -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package && mv target/*.jar /workspace/app.jar
...
FROM eclipse-temurin:21-jre
COPY --from=build /workspace/app.jar /app/app.jar
```

This *does* compile from `src/` on every `docker compose build` — it is not copying a pre-built
jar from the host. That means a `docker compose build` (not just `up`) is required to pick up any
source change; `docker compose up` alone will reuse the previously built image layer if the build
context hash hasn't changed and `--build` isn't passed.

## 2. `docker-compose.yml` service name

The application service in `docker-compose.yml` is named **`app`** (container name `eco-app`),
not `backend`. Use this name in all compose commands below.

## 3. Rebuild + redeploy commands (run by the operator, against the real environment)

```bash
# From the repo root, on the host that has the real docker-compose.yml and .env
docker compose build app
docker compose up -d --force-recreate app
docker compose logs -f app        # watch startup, confirm NormativeResourceSeeder log lines
```

To rule out any layer-caching doubt:

```bash
docker compose build --no-cache app
docker compose up -d --force-recreate app
```

## 4. Post-deploy verification

Once the container is up, verify from the operator's machine (replace host/port/token):

```bash
# Health: real counts computed from the DB, not hardcoded (see NormativeHealthService)
curl -s -H "Authorization: Bearer $TOKEN" https://<host>/api/normatives/health | jq .

# Search: the exact free-text/exact-code/classification-filter behavior fixed in this change
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://<host>/api/normatives/search?query=%D0%9D%D0%B8%D0%BA%D0%B5%D0%BB%D1%8C&status=ACTIVE&page=0&size=50" | jq .
```

Expect `health` to include (see `NormativeHealthService.health()`):
- `total`, `active`, `byTemplate` (real counts from `NormativeRecordRepository`)
- `lastImportAt`, `lastImportStatus` (from the most recent admin-driven Excel `ImportBatch`)
- `importSource: "STARTUP_SEEDER"`, `importStatus` (`OK`/`FAILED`/`NOT_AVAILABLE`), and on failure
  `lastSeederRunAt` + `importErrors` (per-source error map) — this is the new observability added
  for the `NormativeResourceSeeder` startup path, which previously only logged a warning.

## 5. What this sandbox could NOT verify

- No Docker daemon is available here — the `docker compose build`/`up` commands above were **not
  executed**, only read and reasoned about from the Dockerfile/compose file contents.
- No access to the real production MySQL/Mongo data — row counts, `byTemplate` breakdown, and
  actual `lastImportAt` timestamps in a live deployment are unknown from this sandbox.
- The version/build-info endpoint (if added) and its git-commit wiring were only checked in
  source; whether the *deployed* container actually reports the expected commit hash must be
  checked by the operator after the rebuild above.

Everything above the "What this sandbox could NOT verify" section was confirmed by reading the
actual `Dockerfile` and `docker-compose.yml` in this repository, and by running the project's
integration tests against the local H2 test database (see the main task report for results).
