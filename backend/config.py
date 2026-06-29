from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str
    GROQ_API_KEY: str
    FRONTEND_URL: str = "http://localhost:5173"
    AUCTION_TIMER_SECONDS: int = 30

    class Config:
        env_file = ".env"


settings = Settings()

# Groq council models
COUNCIL_MODELS = [
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
    "mixtral-8x7b-32768",
]
CHAIRMAN_MODEL = "llama-3.3-70b-versatile"
