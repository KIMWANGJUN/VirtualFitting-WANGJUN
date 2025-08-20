import json
import uuid
import time
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
import logging
from .redis_config import redis_manager

logger = logging.getLogger(__name__)

class TaskQueue:
    def __init__(self, queue_name: str = "virtual_fitting_queue"):
        self.queue_name = queue_name
        self.processing_set = f"{queue_name}:processing"
        self.result_prefix = f"{queue_name}:result"
        self.status_prefix = f"{queue_name}:status"
        
    def enqueue_task(self, task_type: str, task_data: Dict[str, Any]) -> Optional[str]:
        """작업을 큐에 추가"""
        redis_client = redis_manager.get_client()
        if not redis_client:
            logger.error("Redis 연결 없음")
            return None
        
        try:
            task_id = str(uuid.uuid4())
            task = {
                "id": task_id,
                "type": task_type,
                "data": task_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "QUEUED"
            }
            
            # 작업을 큐에 추가
            redis_client.lpush(self.queue_name, json.dumps(task))
            
            # 작업 상태 저장
            redis_client.setex(
                f"{self.status_prefix}:{task_id}",
                3600 * 24,  # 24시간 TTL
                json.dumps({"status": "QUEUED", "created_at": task["created_at"]})
            )
            
            logger.info(f"작업 큐에 추가됨: {task_id}")
            return task_id
            
        except Exception as e:
            logger.error(f"작업 큐 추가 실패: {e}")
            return None
    
    def dequeue_task(self, timeout: int = 30) -> Optional[Dict[str, Any]]:  # 10 → 30초로 증가
        """큐에서 작업 가져오기 (블로킹)"""
        redis_client = redis_manager.get_client()
        if not redis_client:
            return None
        
        try:
            # 블로킹 방식으로 작업 가져오기
            result = redis_client.brpop(self.queue_name, timeout=timeout)
            if not result:
                return None
            
            task_data = json.loads(result[1])
            task_id = task_data["id"]
            
            # 처리 중 상태로 변경
            redis_client.sadd(self.processing_set, task_id)
            self.update_task_status(task_id, "PROCESSING")
            
            return task_data
            
        except Exception as e:
            logger.error(f"작업 큐에서 가져오기 실패: {e}")
            # Redis 연결 문제인 경우 재연결 시도
            if "timeout" in str(e).lower() or "connection" in str(e).lower():
                logger.info("Redis 연결 문제로 재연결 시도...")
                redis_manager.reconnect()
            return None
    
    def update_task_status(self, task_id: str, status: str, result_data: Optional[Dict] = None):
        """작업 상태 업데이트"""
        redis_client = redis_manager.get_client()
        if not redis_client:
            return
        
        try:
            status_data = {
                "status": status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            if result_data:
                status_data.update(result_data)
            
            redis_client.setex(
                f"{self.status_prefix}:{task_id}",
                3600 * 24,  # 24시간 TTL
                json.dumps(status_data)
            )
            
            # 완료되거나 실패한 경우 처리 중 세트에서 제거
            if status in ["COMPLETED", "FAILED"]:
                redis_client.srem(self.processing_set, task_id)
                
        except Exception as e:
            logger.error(f"작업 상태 업데이트 실패: {e}")
    
    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """작업 상태 조회"""
        redis_client = redis_manager.get_client()
        if not redis_client:
            return None
        
        try:
            status_data = redis_client.get(f"{self.status_prefix}:{task_id}")
            if status_data:
                return json.loads(status_data)
            return None
            
        except Exception as e:
            logger.error(f"작업 상태 조회 실패: {e}")
            return None
    
    def get_queue_info(self) -> Dict[str, int]:
        """큐 정보 조회"""
        redis_client = redis_manager.get_client()
        if not redis_client:
            return {"queued": 0, "processing": 0}
        
        try:
            queued = redis_client.llen(self.queue_name)
            processing = redis_client.scard(self.processing_set)
            return {"queued": queued, "processing": processing}
            
        except Exception as e:
            logger.error(f"큐 정보 조회 실패: {e}")
            return {"queued": 0, "processing": 0}
    
    def clear_failed_tasks(self) -> int:
        """실패한 작업들 정리"""
        redis_client = redis_manager.get_client()
        if not redis_client:
            return 0
        
        try:
            # 실패한 작업 상태 키들 찾기
            failed_keys = []
            pattern = f"{self.status_prefix}:*"
            for key in redis_client.scan_iter(match=pattern):
                status_data = redis_client.get(key)
                if status_data:
                    try:
                        data = json.loads(status_data)
                        if data.get("status") == "FAILED":
                            failed_keys.append(key)
                    except:
                        continue
            
            # 실패한 작업들 삭제
            if failed_keys:
                redis_client.delete(*failed_keys)
                logger.info(f"실패한 작업 {len(failed_keys)}개 정리됨")
                return len(failed_keys)
            
            return 0
            
        except Exception as e:
            logger.error(f"실패한 작업 정리 실패: {e}")
            return 0
    
    def clear_processing_tasks(self) -> int:
        """처리 중인 작업들 정리 (재시작 시)"""
        redis_client = redis_manager.get_client()
        if not redis_client:
            return 0
        
        try:
            # 처리 중인 작업들 가져오기
            processing_tasks = redis_client.smembers(self.processing_set)
            if processing_tasks:
                # 처리 중 상태를 FAILED로 변경
                for task_id in processing_tasks:
                    self.update_task_status(task_id.decode(), "FAILED", {"error": "워커 재시작으로 인한 실패"})
                
                # 처리 중 세트 비우기
                redis_client.delete(self.processing_set)
                logger.info(f"처리 중인 작업 {len(processing_tasks)}개 정리됨")
                return len(processing_tasks)
            
            return 0
            
        except Exception as e:
            logger.error(f"처리 중인 작업 정리 실패: {e}")
            return 0

# 전역 작업 큐 인스턴스
task_queue = TaskQueue()
