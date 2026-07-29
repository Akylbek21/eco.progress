# OpenAPI-generated PEK contract

This directory is intentionally empty until the backend OpenAPI schema is
provided. Generated DTOs and clients must be produced from that schema; they
must not be reconstructed from UI assumptions.

The current compatibility contract is isolated in `../pekContracts.ts`.
Replace its exports with generated types when the Spring Boot OpenAPI document
becomes available, then remove the compatibility aliases after all consumers
have migrated.
