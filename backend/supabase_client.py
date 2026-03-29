from supabase import create_client, Client
from config import settings
import logging

logger = logging.getLogger(__name__)

class SupabaseClient:
    _instance: Client = None
    
    @classmethod
    def get_client(cls) -> Client:
        """Get or create Supabase client instance"""
        if cls._instance is None:
            if not settings.supabase_url or not settings.supabase_key:
                raise ValueError("Supabase URL and Key must be set in environment variables")
            
            cls._instance = create_client(settings.supabase_url, settings.supabase_key)
            logger.info("Supabase client initialized")
        
        return cls._instance
    
    @classmethod
    def get_service_role_client(cls) -> Client:
        """Get Supabase client with service role key for admin operations"""
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise ValueError("Supabase URL and Service Role Key must be set")
        
        return create_client(settings.supabase_url, settings.supabase_service_role_key)
    
    @classmethod
    async def test_connection(cls) -> bool:
        """Test connection to Supabase"""
        try:
            client = cls.get_client()
            # Try to query our actual vector store table
            try:
                client.table(settings.vector_store_table_name).select("*").limit(1).execute()
            except Exception as e:
                error_str = str(e)
                # PGRST205 indicates the connection was successful, but the table does not exist yet.
                if "PGRST205" in error_str:
                    logger.warning(f"Supabase connected successfully, but table '{settings.vector_store_table_name}' is missing.")
                    return True
                raise e
                
            logger.info("Supabase connection test successful")
            return True
        except Exception as e:
            logger.error(f"Supabase connection test failed: {e}")
            return False