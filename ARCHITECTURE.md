# Architecture

## Overview

FanRewards API is a Fastify, TypeScript, TypeORM, and PostgreSQL backend for a music fan rewards system. The API supports account registration, login, token refresh/logout, authenticated user profile APIs, challenges, rewards, leaderboard, and admin challenge management.

The design favors small route plugins, a service layer for business logic, TypeORM repository/Data Mapper style persistence, Typebox schemas for API contracts, and centralized error handling.

## Project Structure

- `src/app.ts` wires the Fastify app, global plugins, database plugin, route plugins, tracing, logging, Swagger, and error handling.
- `src/routes` contains HTTP route plugins. Public auth routes live under `routes/public`, authenticated user-facing routes under `routes/authenticated`, admin routes under `routes/admin`, and health check under `routes/health.ts`.
- `src/services` contains business logic and transaction boundaries.
- `src/entities` contains TypeORM entities and database relations.
- `src/schemas` contains Typebox request and response schemas. TypeScript DTO types are derived from these schemas.
- `src/mappers` converts entities to DTOs and input data to entities.
- `src/middleware` contains authentication and admin API key guards.
- `src/plugins` contains infrastructure plugins such as database, Swagger, request trace, and request logging.

## API Design

Routes are thin by design. They validate input with Typebox, call a service, and return a consistent response envelope.

Success responses use:

```json
{
  "data": {}
}
```

Paginated responses use:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Errors use a centralized envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "traceId": "req-123"
  }
}
```

Request and response schemas are defined with Typebox in `src/schemas`. Routes reuse those schemas for Fastify validation and Swagger documentation, while services reuse the schema-derived TypeScript DTO types when the service input matches the API contract.

## Authentication And Tokens

Authentication uses JWT access and refresh tokens.

- Register creates the account only and returns email/display name.
- Login verifies credentials and returns access/refresh tokens.
- Refresh validates the current refresh token, revokes the old token row, and issues a new pair.
- Logout revokes the stored token pair.

Token generation is isolated behind a `TokenProvider` interface so the JWT implementation can be replaced without changing route logic or `AuthService`.

Raw tokens are never stored. Issued access and refresh tokens are hashed with SHA-256 and stored in `UserTokenEntity`. The `User` entity has a one-to-many relationship with token rows so previous sessions can remain in history while revocation is tracked per token pair.

Authenticated APIs use `Authorization: Bearer <accessToken>`. The auth middleware verifies the JWT, hashes the access token, checks that the token row exists and is not revoked or expired, loads the user, and attaches the user entity to `request.user`.

Admin APIs are protected separately with `x-admin-api-key`. A parent admin route plugin applies the admin hook to every route under `/api/admin`.

## Database Design

The API uses TypeORM entities with repository/Data Mapper style access rather than Active Record. Schema changes are managed through migrations, and `synchronize` is disabled.

Core entities:

- `User`: account identity, password hash, display name, total points.
- `Challenge`: music challenge metadata, points, duration, difficulty, active status.
- `ChallengeCompletion`: user completion records and earned points.
- `Reward`: redeemable reward metadata and point cost.
- `RewardRedemption`: reward redemption history.
- `UserTokenEntity`: hashed issued token pairs and revocation state.

Important constraints and indexes include unique user email, unique reward name, and unique challenge title/artist. Challenge and reward list filters have indexes on fields such as difficulty, active status, and availability.

## Business Logic

Challenge completion awards full points when listen percentage is at least 80%. Below 80%, points are awarded proportionally and rounded down. A user may complete the same challenge multiple times.

Reward redemption deducts points and creates a pending redemption. The operation runs inside a `READ COMMITTED` transaction and locks the user row with `pessimistic_write` to prevent concurrent requests from overspending the same point balance.

Leaderboard ranking sorts users by total points and handles ties by assigning the same rank to equal point totals.

## Observability

Every request receives a trace ID using Fastify request IDs and the `x-trace-id` header. The response always includes the trace ID, and error responses include it in the error envelope.

Request lifecycle logging records method, URL, status code, duration, trace ID, and authenticated user ID when available. It intentionally does not log request bodies, response bodies, authorization headers, cookies, access tokens, refresh tokens, or admin API keys.

Unexpected errors are logged centrally by the error handler with the original error, method, URL, and trace ID. Stack traces are not exposed in API responses.

## Developer Tooling

Swagger/OpenAPI documentation is registered only outside production and is available at `/docs`. Route schemas are grouped by tags and authenticated routes declare bearer auth metadata.

The `/health` endpoint verifies database connectivity with a lightweight `SELECT 1` query and returns `503` when the database is unavailable.

Seed data is loaded with `npm run seed`. The seed script uses database uniqueness constraints to upsert the README sample challenges and rewards idempotently.

## Testing Strategy

Tests focus on public API behavior and service behavior.

- Route tests use Fastify `inject` and fake repositories/data sources where possible.
- Service tests cover business rules such as challenge points, reward redemption, leaderboard ranking, and auth token behavior.
- Mapper tests cover entity-to-DTO conversion and token hashing.
- Build verification with `npm run build` ensures TypeScript and schema-derived DTO types remain consistent.

The main verification commands are:

```bash
npm run build
npm test
```
