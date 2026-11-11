import redis

from src.core.config import settings

redis_client = redis.Redis(
    host=settings.redis_host,
    port=settings.redis_port,
    username=settings.redis_username,
    password=settings.redis_password or None,
    ssl=settings.redis_ssl,
    decode_responses=True,
    socket_connect_timeout=5,
    socket_timeout=5,
)


def get_redis():
    """Return the Redis client."""
    return redis_client
