# Configuración Azure AD — Hidrobart Login Institucional

## 1. Crear la App Registration en Azure

Ve a: **portal.azure.com → Azure Active Directory → App registrations → New registration**

| Campo | Valor |
|-------|-------|
| Name | `Hidrobart-LoginInstitucional` |
| Supported account types | **Accounts in any organizational directory (Any Azure AD directory - Multitenant)** |
| Redirect URI (Web) | `https://login.hidrobart.com/api/auth/callback/azure-ad` |

> ⚠️ Seleccionar **Multitenant** para que funcione con hidrobart.com, .com.mx y .com.br

---

## 2. Permisos de API (Microsoft Graph)

En la app registration → **API permissions → Add a permission → Microsoft Graph → Delegated**:

| Permiso | Tipo | Para qué sirve |
|---------|------|----------------|
| `openid` | Delegated | Login |
| `profile` | Delegated | Nombre del usuario |
| `email` | Delegated | Email del usuario |
| `User.Read` | Delegated | Leer perfil propio |
| `GroupMember.Read.All` | Delegated | Leer grupos del usuario (roles de org) |

**Dar Grant Admin Consent** para todos los permisos.

---

## 3. Client Secret

En la app → **Certificates & secrets → New client secret**
- Description: `hidrobart-login-prod`
- Expires: 24 months

**Copiar el valor** (solo se muestra una vez) → va a `AZURE_CLIENT_SECRET`

---

## 4. Tokens Configuration

En la app → **Token configuration → Add optional claim**:

Para **ID token**, agregar:
- `email`
- `family_name`
- `given_name`
- `upn` (UPN del usuario)

---

## 5. Configurar grupos en el token

En **Manifest** del app registration, buscar `groupMembershipClaims` y cambiar a:
```json
"groupMembershipClaims": "All"
```

---

## 6. Nombres de Grupos en Azure AD

Para que los roles funcionen, los grupos de Azure AD deben seguir este patrón:

| Nombre del grupo en Azure AD | Rol resultante |
|------------------------------|----------------|
| `Hidrobart-SuperAdmin` | SuperAdmin |
| `Hidrobart-Admin` | Admin |
| `Hidrobart-Managers` | Manager |
| `Hidrobart-Employees` | Employee |
| `Hidrobart-External` | External |

Los grupos se mapean automáticamente. Si un usuario está en `Hidrobart-Managers`, obtendrá el rol `Manager`.

---

## 7. Variables de entorno finales

### Backend (.env)
```env
AZURE_CLIENT_ID=<Application (client) ID>
AZURE_CLIENT_SECRET=<Client secret value>
AZURE_TENANT_ID=common
REDIS_HOST=<tu-nuevo-redis>.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=<access key del Redis>
REDIS_SSL=true
```

### Frontend (.env.local)
```env
NEXTAUTH_URL=https://login.hidrobart.com
NEXTAUTH_SECRET=<openssl rand -base64 32>
AZURE_CLIENT_ID=<mismo que backend>
AZURE_CLIENT_SECRET=<mismo que backend>
AZURE_TENANT_ID=common
NEXT_PUBLIC_AUTH_API=https://auth-api.hidrobart.com
```

---

## 8. Nuevo Redis para Auth Sessions

En Azure Portal → Create Resource → **Azure Cache for Redis**:

| Campo | Valor recomendado |
|-------|-------------------|
| Name | `hidrobart-auth-redis` |
| Location | Canada Central (igual que el existente) |
| Cache SKU | **Basic C1** (1 GB, para auth sessions) |
| Redis version | 7 |
| Non-SSL port | **Disabled** (usar solo SSL 6380) |

> El Redis existente (`hiroplus-redis`) puede quedarse para la app HidroPlus.
> Este nuevo Redis es exclusivo para sesiones de auth.

**Activar Microsoft Entra ID** en el Redis nuevo (el aviso que veías en la imagen):
Settings → Authentication → Enable Microsoft Entra Authentication

---

## 9. Registrar URLs de redirección adicionales

Para cada ambiente, agregar en **Authentication → Add a platform → Web → Redirect URIs**:

```
https://login.hidrobart.com/api/auth/callback/azure-ad
https://login.hidrobart.com.mx/api/auth/callback/azure-ad
https://login.hidrobart.com.br/api/auth/callback/azure-ad
http://localhost:3000/api/auth/callback/azure-ad  (solo desarrollo)
```

---

## 10. Test rápido

```bash
# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend && npm install
npm run dev

# Abrir: http://localhost:3000/login
```
