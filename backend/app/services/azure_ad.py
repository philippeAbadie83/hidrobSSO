"""
Servicio Azure AD — OAuth2, MSAL, Graph API
Multi-tenant: hidrobart.com | hidrobart.com.mx | hidrobart.com.br
"""
import msal
import httpx
import logging
from typing import Optional
from urllib.parse import urlencode

from app.core.config import settings
from app.core.security import is_allowed_domain

logger = logging.getLogger(__name__)


class AzureADService:
    """Gestiona la integración con Azure AD vía MSAL."""

    def __init__(self):
        self._app: Optional[msal.ConfidentialClientApplication] = None

    def get_msal_app(self) -> msal.ConfidentialClientApplication:
        """Crea la app MSAL (Confidential Client para backend)."""
        if self._app is None:
            self._app = msal.ConfidentialClientApplication(
                client_id=settings.AZURE_CLIENT_ID,
                client_credential=settings.AZURE_CLIENT_SECRET,
                authority=settings.AZURE_AUTHORITY,
                # Cache en memoria (Redis para producción)
            )
        return self._app

    def get_authorization_url(
        self,
        redirect_uri: str,
        state: str,
        nonce: str,
        prompt: str = "select_account",
    ) -> str:
        """
        Genera la URL de autorización de Azure AD.
        El usuario será redirigido aquí para hacer login con su cuenta MS365.
        """
        app = self.get_msal_app()
        auth_url = app.get_authorization_request_url(
            scopes=settings.AZURE_SCOPE,
            redirect_uri=redirect_uri,
            state=state,
            nonce=nonce,
            prompt=prompt,
            # domain_hint para multi-tenant — el usuario escoge su dominio
            # domain_hint="hidrobart.com",  # descomentar si quieres forzar dominio
        )
        return auth_url

    async def exchange_code_for_tokens(
        self,
        code: str,
        redirect_uri: str,
    ) -> dict:
        """
        Intercambia el authorization code por access_token + id_token.
        Llamado después del callback de Azure AD.
        """
        app = self.get_msal_app()
        result = app.acquire_token_by_authorization_code(
            code=code,
            scopes=settings.AZURE_SCOPE,
            redirect_uri=redirect_uri,
        )
        if "error" in result:
            error_desc = result.get("error_description", result.get("error"))
            logger.error(f"MSAL token exchange error: {error_desc}")
            raise ValueError(f"Error al autenticar con Microsoft: {error_desc}")
        return result

    async def get_user_profile(self, access_token: str) -> dict:
        """Obtiene perfil completo del usuario desde Microsoft Graph."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://graph.microsoft.com/v1.0/me",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "ConsistencyLevel": "eventual",
                },
                params={
                    "$select": (
                        "id,displayName,givenName,surname,mail,userPrincipalName,"
                        "jobTitle,department,officeLocation,companyName,"
                        "mobilePhone,businessPhones,accountEnabled"
                    )
                },
                timeout=10,
            )
            resp.raise_for_status()
            return resp.json()

    async def get_user_groups(self, access_token: str) -> list[dict]:
        """
        Obtiene todos los grupos de Azure AD del usuario.
        Estos mapean a los roles de organización.
        Maneja paginación automáticamente.
        """
        groups = []
        url = "https://graph.microsoft.com/v1.0/me/memberOf"
        params = {"$select": "id,displayName,description,groupTypes"}

        async with httpx.AsyncClient() as client:
            while url:
                resp = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {access_token}"},
                    params=params if "memberOf" in url else None,
                    timeout=15,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    groups.extend(data.get("value", []))
                    url = data.get("@odata.nextLink")
                    params = None  # nextLink ya tiene params
                else:
                    logger.warning(
                        f"Graph groups fetch failed: {resp.status_code}"
                    )
                    break
        return groups

    async def get_user_photo(self, access_token: str) -> Optional[bytes]:
        """Obtiene foto de perfil del usuario."""
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://graph.microsoft.com/v1.0/me/photo/$value",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10,
            )
            if resp.status_code == 200:
                return resp.content
            return None

    def validate_user_domain(self, email: str) -> bool:
        """Verifica que el usuario pertenece a un dominio Hidrobart."""
        return is_allowed_domain(email)

    def extract_tenant_from_claims(self, id_token_claims: dict) -> str:
        """
        Extrae el tenant del usuario desde los claims del token.
        tid = tenant ID de Azure AD.
        """
        tid = id_token_claims.get("tid", "")
        email = id_token_claims.get(
            "preferred_username",
            id_token_claims.get("email", ""),
        )
        # Detectar dominio del email
        domain = email.split("@")[-1].lower() if "@" in email else ""
        # Mapear a dominio Hidrobart
        for allowed in settings.ALLOWED_DOMAINS:
            if domain == allowed.lower():
                return allowed
        return domain or tid

    def map_groups_to_org_roles(self, groups: list[dict]) -> list[str]:
        """
        Mapea grupos de Azure AD a roles de organización Hidrobart.
        Convención de nombres de grupos en Azure AD:
          - "Hidrobart-SuperAdmin" → SuperAdmin
          - "Hidrobart-Managers" → Manager
          - etc.
        """
        role_map = {
            "superadmin": "SuperAdmin",
            "super_admin": "SuperAdmin",
            "admin": "Admin",
            "administrator": "Admin",
            "manager": "Manager",
            "gerente": "Manager",
            "employee": "Employee",
            "empleado": "Employee",
            "staff": "Employee",
            "colaborador": "Employee",
            "external": "External",
            "externo": "External",
            "proveedor": "External",
        }
        org_roles = set()
        for group in groups:
            name = group.get("displayName", "").lower()
            # Buscar coincidencias en el nombre del grupo
            for keyword, role in role_map.items():
                if keyword in name:
                    org_roles.add(role)
                    break
        # Si no hay rol, asignar Employee por defecto
        if not org_roles:
            org_roles.add("Employee")
        return list(org_roles)


# Singleton
azure_ad_service = AzureADService()
