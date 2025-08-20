import os
import redis
from typing import Optional
import json
import logging
import time

logger = logging.getLogger(__name__)

class RedisManager:
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.max_retries = 3
        self._connect()
    
    def _connect(self):
        """Redis 연결 설정"""
        for attempt in range(self.max_retries):
            try:
                # 환경변수에서 Redis 설정 가져오기
                redis_url = os.getenv('REDIS_URL')
                redis_host = os.getenv('REDIS_HOST', 'localhost')
                redis_port = int(os.getenv('REDIS_PORT', 6379))
                redis_password = os.getenv('REDIS_PASSWORD')
                redis_db = int(os.getenv('REDIS_DB', 0))
                
                if redis_url:
                    # Redis URL이 있는 경우 (Upstash 등)
                    self.redis_client = redis.from_url(
                        redis_url,
                        decode_responses=True,
                        socket_connect_timeout=30,    # 5 → 30초로 증가
                        socket_timeout=30,           # 5 → 30초로 증가
                        socket_keepalive=True,       # keepalive 활성화
                        socket_keepalive_options={},
                        retry_on_timeout=True,
                        health_check_interval=10     # 연결 상태 주기적 확인
                    )
                else:
                    # 개별 설정으로 연결
                    self.redis_client = redis.Redis(
                        host=redis_host,
                        port=redis_port,
                        password=redis_password,
                        db=redis_db,
                        decode_responses=True,
                        socket_connect_timeout=30,    # 5 → 30초로 증가
                        socket_timeout=30,           # 5 → 30초로 증가
                        socket_keepalive=True,       # keepalive 활성화
                        socket_keepalive_options={},
                        retry_on_timeout=True,
                        health_check_interval=10,    # 연결 상태 주기적 확인
                        max_connections=20           # 연결 풀 크기 설정
                    )
                
                # 연결 테스트
                self.redis_client.ping()
                logger.info(f"Redis 연결 성공 (시도 {attempt + 1}/{self.max_retries})")
                break
                
            except Exception as e:
                logger.warning(f"Redis 연결 실패 (시도 {attempt + 1}/{self.max_retries}): {e}")
                if attempt < self.max_retries - 1:
                    time.sleep(2 ** attempt)  # 지수 백오프
                else:
                    logger.error("Redis 연결 완전 실패")
                    self.redis_client = None
    
    def is_connected(self) -> bool:
        """Redis 연결 상태 확인"""
        if not self.redis_client:
            return False
        try:
            self.redis_client.ping()
            return True
        except Exception as e:
            logger.warning(f"Redis 연결 상태 확인 실패: {e}")
            return False
    
    def get_client(self) -> Optional[redis.Redis]:
        """Redis 클라이언트 반환"""
        if not self.is_connected():
            logger.info("Redis 재연결 시도...")
            self._connect()
        return self.redis_client
    
    def reconnect(self):
        """강제 재연결"""
        logger.info("Redis 강제 재연결...")
        if self.redis_client:
            try:
                self.redis_client.close()
            except:
                pass
        self._connect()

# 전역 Redis 매니저 인스턴스
redis_manager = RedisManager()
