# Belong FanRewards API

Belong FanRewards API is a TypeScript backend for a music fan rewards experience. It provides account authentication, challenge completion, reward redemption, leaderboard, and admin challenge management endpoints.

Built with Node.js, Fastify, TypeORM, PostgreSQL, Typebox, and Jest. For architecture, business rules, database design, token behavior, and observability details, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Prerequisites

- Node.js and npm
- Docker and Docker Compose

## Quick Start

```bash
# 1. Copy env file
cp .env.example .env

# 2. Start PostgreSQL
docker compose up -d

# 3. Install dependencies
npm install

# 4. Generate and run migrations
npm run migration:generate src/migrations/Init
npm run migration:run

# 5. Seed the database
npm run seed

# 6. Start dev server
npm run dev
```

Server runs on `http://localhost:3000`.

Swagger UI is available in non-production at `http://localhost:3000/docs/static/index.html#/`.

`docker compose up -d` starts both configured PostgreSQL services from [docker-compose.yml](docker-compose.yml): the main development database on port `5432` and the test database on port `5433`.

## Environment Variables

Copy [.env.example](.env.example) to `.env` and adjust values as needed.

| Variable | Purpose | Default/local value |
| --- | --- | --- |
| `PORT` | HTTP server port | `3000` |
| `LOG_LEVEL` | Fastify logger level | `info` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | PostgreSQL username | `belong` |
| `DB_PASSWORD` | PostgreSQL password | `belong_dev` |
| `DB_DATABASE` | PostgreSQL database name | `fan_rewards` |
| `JWT_ACCESS_SECRET` | Secret used to sign access tokens | Set in `.env` |
| `JWT_REFRESH_SECRET` | Secret used to sign refresh tokens | Set in `.env` |
| `ADMIN_API_KEY` | API key for `/api/admin/*` routes | Add to `.env` |

Replace JWT and admin secrets outside local development.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server with reloads |
| `npm run build` | Compile TypeScript into `dist` |
| `npm start` | Run the compiled app from `dist/app.js` |
| `npm test` | Run the Jest test suite |
| `npm run test:coverage` | Run tests with coverage output |
| `npm run migration:generate` | Generate a TypeORM migration |
| `npm run migration:run` | Run pending TypeORM migrations |
| `npm run migration:revert` | Revert the last TypeORM migration |
| `npm run seed` | Seed sample challenges and rewards |

## API Usage

Successful responses use a `data` envelope. Paginated responses include a `meta` object. Error responses include `error.code`, `error.message`, and `error.traceId`.

Use these headers when calling protected endpoints:

```http
Authorization: Bearer <accessToken>
x-admin-api-key: <adminApiKey>
```

For full request and response contracts, use Swagger UI or see [ARCHITECTURE.md](ARCHITECTURE.md).

### Public

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Authenticated

- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users/me/stats`
- `GET /api/challenges`
- `GET /api/challenges/:id`
- `POST /api/challenges/:id/complete`
- `GET /api/rewards`
- `POST /api/rewards/:id/redeem`
- `GET /api/rewards/history`
- `GET /api/leaderboard`
- `GET /api/leaderboard/me`

### Admin

- `POST /api/admin/challenges`
- `GET /api/admin/challenges`
- `GET /api/admin/challenges/:id`
- `PATCH /api/admin/challenges/:id`
- `DELETE /api/admin/challenges/:id`

## Example Requests

Register a user:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"fan@example.com","password":"password123","displayName":"Fan One"}'
```

Log in:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fan@example.com","password":"password123"}'
```

List challenges:

```bash
curl http://localhost:3000/api/challenges \
  -H "Authorization: Bearer <accessToken>"
```

Create an admin challenge:

```bash
curl -X POST http://localhost:3000/api/admin/challenges \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: <adminApiKey>" \
  -d '{"title":"New Track","artist":"Example Artist","description":"Listen and earn points","points":100,"durationSeconds":180,"difficulty":"easy","isActive":true}'
```

## Testing And Verification

Run these checks before submitting changes:

```bash
npm run build
npm test
npm run test:coverage
```

## Useful Links

- [ARCHITECTURE.md](ARCHITECTURE.md) - architecture, business rules, database design, and API behavior
- [.env.example](.env.example) - local environment template
- [docker-compose.yml](docker-compose.yml) - local PostgreSQL services
- Swagger UI - `http://localhost:3000/docs/static/index.html#/`
