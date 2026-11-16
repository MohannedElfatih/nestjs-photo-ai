# NestJS Photo Library

A backend API built with NestJS and PostgreSQL. Users sign up and upload
photos, Gemini writes a description and tags for each one, and photos can be searched by meaning.

## Run with Docker

You need Docker and a free [Gemini API key](https://aistudio.google.com).

```bash
cp .env.example .env    # set GEMINI_API_KEY
docker compose up --build
```

Open <http://localhost:3000/api> for the API docs. Sign up with `POST /auth/sign-up`, then use the other routes.

## Run locally

Needs [Bun](https://bun.sh) and Postgres with the `pgvector` extension:

```bash
docker run --name nest-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nestlearn -p 5432:5432 -d pgvector/pgvector:pg17
bun install
cp .env.example .env    # set GEMINI_API_KEY
bun run start:dev
```

## Tests

```bash
bun run test        # unit tests
bun run test:e2e    # end-to-end, needs the Postgres container running
```
