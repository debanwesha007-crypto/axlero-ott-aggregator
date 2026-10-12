import redis

from src.core.config import settings

redis_client = redis.Redis(
    host="localhost",
    port=6379,
    decode_responses=True,
    socket_connect_timeout=2,
    socket_timeout=2,
)

def get_redis():
    """Return the Redis client."""
    return redis_client