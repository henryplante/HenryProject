# ClearPath Review API

Spring Boot 3 backend for ClearPath Review.

## Prerequisites

- Java 21
- Postgres 16 (see repo-root `docker-compose.yml` or a local instance)

## Configuration

Copy `.env.example` and export variables, or set:

- `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`
- `SESSION_SECRET` (HMAC key for the `clearpath_session` cookie)
- `SERVER_PORT` (default `8080`)

## Run

```bash
cd api
./gradlew bootRun
```

Health check: `GET http://localhost:8080/api/health`

## Tests

```bash
TEST_DATABASE_URL=jdbc:postgresql://localhost:5432/clearpath_be01_test ./gradlew test
```

Uses Testcontainers when Docker is available; otherwise connects to `TEST_DATABASE_URL`.
