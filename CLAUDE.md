# Instrucciones del Proyecto — hidrosso

## ⚠️ REGLAS IMPORTANTES

- **NO usar Docker ni docker-compose** bajo ninguna circunstancia. Philippe no trabaja con Docker.
- El proyecto corre directamente con `uvicorn` (FastAPI) y `npm run dev` (Next.js) en la máquina o VM.
- Para Redis usar **Azure Cache for Redis** directamente (no Redis local en contenedor).
- **NO usar guiones en nombres de carpetas** (evitar `algo-algo2`, `mi-proyecto`, etc). Usar nombres simples sin separadores: `hidrosso`, `authcore`, `frontend`, `backend`.

## Stack

- **Frontend:** Next.js 15 (App Router) — correr con `npm run dev` en puerto 3000
- **Backend:** FastAPI + uvicorn — correr con `uvicorn app.main:app --reload` en puerto 8000
- **Auth:** Microsoft 365 / Azure AD (multi-tenant)
- **Sesiones:** Azure Cache for Redis (SSL, puerto 6380)

## Comandos para correr el proyecto

```bash
# Backend
cd backend
pip install -r requirements.txt
cp .env.example .env   # completar variables
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
cd frontend
npm install
cp .env.example .env.local   # completar variables
npm run dev
```

## Dominios Hidrobart

- hidrobart.com
- hidrobart.com.mx
- hidrobart.com.br

## Arquitectura de roles

3 capas: OrgRoles (Azure AD groups) → FunctionalRoles (DB) → ProcessRoles (permisos por módulo)
