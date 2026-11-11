from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/axlero_ott"
    secret_key: str
    access_token_expire_minutes: int = 30

    redis_host: str = "127.0.0.1"
    redis_port: int = 6379
    redis_username: str = "default"
    redis_password: str = ""
    redis_ssl: bool = False
    watchmode_api_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
