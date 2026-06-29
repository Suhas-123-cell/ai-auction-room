import jwt
from supabase import create_client, Client
from .config import settings

_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase_client


def verify_token(token: str) -> dict | None:
    """Verify a Supabase JWT and return the payload, or None if invalid."""
    try:
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_profile(user_id: str) -> dict | None:
    """Fetch a user profile from Supabase by user_id."""
    sb = get_supabase()
    result = sb.table("profiles").select("*").eq("id", user_id).execute()
    if result.data:
        return result.data[0]
    return None
