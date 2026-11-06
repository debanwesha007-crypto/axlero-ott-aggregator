import redis

from src.core.config import settings

redis_client = redis.Redis(
    host="127.0.0.1",
    port=6379,
    decode_responses=True,
    socket_connect_timeout=0.3,
    socket_timeout=0.3,
)


def get_redis():
    """Return the Redis client."""
    return redis_client