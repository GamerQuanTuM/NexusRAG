import os
from pydantic_settings import BaseSettings
from pydantic import field_validator
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    # Supabase Configuration
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_key: str = os.getenv("SUPABASE_KEY", "")
    supabase_service_role_key: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # OpenAI-Compatible API Configuration
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_api_base: str = os.getenv("OPENAI_API_BASE", "")

    # Gemini Configuration
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")

    # Embedding Model
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "")

    # LLM Model
    llm_model: str = os.getenv("LLM_MODEL", "")

    # Server Configuration
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    debug: bool = True

    # Vector Store Configuration
    vector_store_table_name: str = os.getenv("VECTOR_STORE_TABLE_NAME", "documents")
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "1000"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "200"))

    # CORS Configuration
    cors_origins: list = ["*"]

    @field_validator("debug", mode="before")
    @classmethod
    def validate_debug(cls, v):
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            v_lower = v.strip().lower()
            if v_lower in ("true", "1", "yes", "y", "on"):
                return True
            elif v_lower in ("false", "0", "no", "n", "off"):
                return False
            else:
                # For values like "WARN", default to True
                return True
        # Default to True
        return True

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
