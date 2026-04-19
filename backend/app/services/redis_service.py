"""
Servicio Redis — gestión de sesiones y caché de roles
Redis NEW dedicado a auth (hidrobart-auth-redis.redis.cache.windows.net)
"""
import json
import redis.asyncio as aioredis
from datetime import datetime, timezone
from typing import Optional
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisService:
    def __init__(self):
        self._client: Optional[aioredis.Redis] = None

    async def get_client(self) -> aioredis.Redis:
        if self._client is None:
            self._client = aioredis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                ssl=settings.REDIS_SSL,
                db=settings.REDIS_DB,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
            )
        return self._client

    def _session_key(self, session_id: str) -> str:
        return f"{settings.REDIS_KEY_PREFIX}{settings.REDIS_SESSION_PREFIX}{session_id}"

    def _roles_key(self, user_id: str) -> str:
        return f"{settings.REDIS_KEY_PREFIX}{settings.REDIS_ROLES_PREFIX}{user_id}"

    def _refresh_key(self, user_id: str) -> str:
        return f"{settings.REDIS_KEY_PREFIX}{settings.REDIS_REFRESH_PREFIX}{user_id}"

    # ── Sesiones ─────────────────────────────────────────────────────────────

    async def create_session(self, session_id: str, data: dict) -> bool:
        """Crea una sesión en Redis con TTL."""
        client = await self.get_client()
        key = self._session_key(session_id)
        try:
            data["created_at"] = datetime.now(timezone.utc).isoformat()
            await client.setex(
                key,
                settings.SESSION_TTL_SECONDS,
                json.dumps(data, default=str),
            )
            logger.info(f"Session created: {session_id[:8]}...")
            return True
        except Exception as e:
            logger.error(f"Redis create_session error: {e}")
            return False

    async def get_session(self, session_id: str) -> Optional[dict]:
        """Obtiene datos de sesión."""
        client = await self.get_client()
        key = self._session_key(session_id)
        try:
            raw = await client.get(key)
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.error(f"Redis get_session error: {e}")
            return None

    async def refresh_session_ttl(self, session_id: str) -> bool:
        """Extiende el TTL de una sesión activa (sliding expiration)."""
        client = await self.get_client()
        key = self._session_key(session_id)
        try:
            return bool(await client.expire(key, settings.SESSION_TTL_SECONDS))
        except Exception as e:
            logger.error(f"Redis refresh_session_ttl error: {e}")
            return False

    async def delete_session(self, session_id: str) -> bool:
        """Elimina una sesión (logout)."""
        client = await self.get_client()
        key = self._session_key(session_id)
        try:
            await client.delete(key)
            logger.info(f"Session deleted: {session_id[:8]}...")
            return True
        except Exception as e:
            logger.error(f"Redis delete_session error: {e}")
            return False

    async def session_exists(self, session_id: str) -> bool:
        client = await self.get_client()
        return bool(await client.exists(self._session_key(session_id)))

    # ── Caché de Roles ────────────────────────────────────────────────────────

    async def cache_user_roles(self, user_id: str, roles: dict, ttl: int = 900) -> bool:
        """Cachea roles del usuario por 15 min (evita llamar Graph en cada request)."""
        client = await self.get_client()
        key = self._roles_key(user_id)
        try:
            await client.setex(key, ttl, json.dumps(roles))
            return True
        except Exception as e:
            logger.error(f"Redis cache_user_roles error: {e}")
            return False

    async def get_cached_roles(self, user_id: str) -> Optional[dict]:
        """Obtiene roles cacheados."""
        client = await self.get_client()
        key = self._roles_key(user_id)
        try:
            raw = await client.get(key)
            return json.loads(raw) if raw else None
        except Exception as e:
            logger.error(f"Redis get_cached_roles error: {e}")
            return None

    async def invalidate_user_roles(self, user_id: str) -> bool:
        """Invalida caché de roles (cuando se asignan nuevos roles)."""
        client = await self.get_client()
        try:
            await client.delete(self._roles_key(user_id))
            return True
        except Exception as e:
            logger.error(f"Redis invalidate_user_roles error: {e}")
            return False

    # ── Refresh Tokens ────────────────────────────────────────────────────────

    async def store_refresh_token(
        self, user_id: str, refresh_token_hash: str
    ) -> bool:
        """Almacena hash del refresh token."""
        client = await self.get_client()
        key = self._refresh_key(user_id)
        try:
            await client.setex(
                key,
                settings.REFRESH_TOKEN_TTL_SECONDS,
                refresh_token_hash,
            )
            return True
        except Exception as e:
            logger.error(f"Redis store_refresh_token error: {e}")
            return False

    async def validate_refresh_token(
        self, user_id: str, token_hash: str
    ) -> bool:
        client = await self.get_client()
        stored = await client.get(self._refresh_key(user_id))
        return stored == token_hash

    async def revoke_refresh_token(self, user_id: str) -> bool:
        client = await self.get_client()
        await client.delete(self._refresh_key(user_id))
        return True

    # ── Health ────────────────────────────────────────────────────────────────

    async def ping(self) -> bool:
        try:
            client = await self.get_client()
            return await client.ping()
        except Exception:
            return False

    async def close(self):
        if self._client:
            await self._client.aclose()


# Singleton
redis_service = RedisService()
