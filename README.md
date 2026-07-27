# E-commerce Admin Dashboard — Backend

Admin dashboard REST API. NestJS-style module structure using Express + TypeScript.


## Stack
- Node.js 20, Express, TypeScript
- Prisma ORM → Supabase (Postgres)
- Supabase Storage (media uploads)
- JWT (access + refresh, custom-rolled, not Supabase Auth)
- Zod validation

## Setup
```bash
npm install
cp .env   # fill in real values
npm run dev
```

## Env vars
See `.env.example`.

## Verify it's running
```bash
curl http://localhost:4000/health
```

## Module build order
Auth → Permission → Role → User → Media → Category → Brand → Attribute → Product
(each depends on the ones before it)