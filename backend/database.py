from supabase import create_client, Client
from .config import settings

_supabase_client: Client | None = None


def get_supabase() -> Client:
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _supabase_client


def verify_token(token: str) -> dict | None:
    """Verify a Supabase JWT using the admin auth client."""
    try:
        sb = get_supabase()
        resp = sb.auth.get_user(token)
        if resp and resp.user:
            return {"sub": resp.user.id}
        return None
    except Exception as e:
        print(f"Token verify error: {e}")
        return None


def get_user_profile(user_id: str) -> dict | None:
    """Fetch a user profile from Supabase by user_id."""
    sb = get_supabase()
    result = sb.table("profiles").select("*").eq("id", user_id).execute()
    if result.data:
        return result.data[0]
    return None
