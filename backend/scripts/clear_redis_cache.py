#!/usr/bin/env python3
"""
Development script to clear Redis cache and reset rate limits.

This script helps with development by clearing Redis cache and resetting
rate limits that might be blocking legitimate requests.
"""

import os
import sys
import redis
from redis import Redis

def clear_redis_cache():
    """Clear all Redis cache data."""
    try:
        # Get Redis connection
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
        client = Redis.from_url(redis_url, decode_responses=True)
        
        # Test connection
        client.ping()
        print("✅ Connected to Redis successfully")
        
        # Clear all data
        client.flushdb()
        print("✅ Redis cache cleared successfully")
        
        # Show some stats
        info = client.info()
        print(f"📊 Redis Stats:")
        print(f"   - Connected clients: {info.get('connected_clients', 0)}")
        print(f"   - Used memory: {info.get('used_memory_human', '0B')}")
        print(f"   - Total commands: {info.get('total_commands_processed', 0)}")
        
        return True
        
    except redis.ConnectionError:
        print("❌ Failed to connect to Redis")
        print("   Make sure Redis is running: docker-compose up -d")
        return False
    except Exception as e:
        print(f"❌ Error clearing Redis cache: {e}")
        return False

def reset_rate_limits():
    """Reset all rate limit counters."""
    try:
        # Get Redis connection
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
        client = Redis.from_url(redis_url, decode_responses=True)
        
        # Find and delete rate limit keys
        rate_limit_keys = client.keys("rate_limit:*")
        if rate_limit_keys:
            deleted = client.delete(*rate_limit_keys)
            print(f"✅ Reset {deleted} rate limit counters")
        else:
            print("ℹ️  No rate limit counters found")
        
        return True
        
    except Exception as e:
        print(f"❌ Error resetting rate limits: {e}")
        return False

def show_redis_status():
    """Show current Redis status."""
    try:
        # Get Redis connection
        redis_url = os.getenv("REDIS_URL", "redis://redis:6379")
        client = Redis.from_url(redis_url, decode_responses=True)
        
        # Test connection
        client.ping()
        print("✅ Redis is running and accessible")
        
        # Show stats
        info = client.info()
        print(f"📊 Redis Status:")
        print(f"   - Version: {info.get('redis_version', 'Unknown')}")
        print(f"   - Connected clients: {info.get('connected_clients', 0)}")
        print(f"   - Used memory: {info.get('used_memory_human', '0B')}")
        print(f"   - Total commands: {info.get('total_commands_processed', 0)}")
        print(f"   - Keyspace hits: {info.get('keyspace_hits', 0)}")
        print(f"   - Keyspace misses: {info.get('keyspace_misses', 0)}")
        
        # Show current keys
        all_keys = client.keys("*")
        if all_keys:
            print(f"🔑 Current keys ({len(all_keys)}):")
            for key in sorted(all_keys):
                ttl = client.ttl(key)
                if ttl > 0:
                    print(f"   - {key} (TTL: {ttl}s)")
                else:
                    print(f"   - {key}")
        else:
            print("🔑 No keys in Redis")
        
        return True
        
    except redis.ConnectionError:
        print("❌ Redis is not accessible")
        print("   Make sure Redis is running: docker-compose up -d")
        return False
    except Exception as e:
        print(f"❌ Error checking Redis status: {e}")
        return False

def main():
    """Main function."""
    print("🔄 Redis Development Helper")
    print("=" * 40)
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python clear_redis_cache.py status    - Show Redis status")
        print("  python clear_redis_cache.py clear     - Clear all cache")
        print("  python clear_redis_cache.py reset     - Reset rate limits")
        print("  python clear_redis_cache.py all       - Clear cache and reset rate limits")
        return
    
    command = sys.argv[1].lower()
    
    if command == "status":
        show_redis_status()
    elif command == "clear":
        clear_redis_cache()
    elif command == "reset":
        reset_rate_limits()
    elif command == "all":
        print("🧹 Clearing cache and resetting rate limits...")
        clear_redis_cache()
        reset_rate_limits()
        print("✅ All done!")
    else:
        print(f"❌ Unknown command: {command}")
        print("Available commands: status, clear, reset, all")

if __name__ == "__main__":
    main()
