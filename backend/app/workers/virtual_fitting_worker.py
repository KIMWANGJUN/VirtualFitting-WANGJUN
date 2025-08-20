import time
import signal
import sys
import logging
import gc
import psutil
from typing import Dict, Any
from pathlib import Path

from app.core.task_queue import task_queue
from app.utils.virtual_fitting_service import fitting_service_redis

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class VirtualFittingWorker:
    def __init__(self):
        self.running = True
        self.ootd_loaded = False
        self.setup_signal_handlers()
        self.preload_ootd_modules()
    
    def setup_signal_handlers(self):
        """시그널 핸들러 설정"""
        signal.signal(signal.SIGINT, self.signal_handler)
        signal.signal(signal.SIGTERM, self.signal_handler)
    
    def signal_handler(self, signum, frame):
        """종료 시그널 처리"""
        logger.info(f"종료 시그널 수신: {signum}")
        self.running = False
    
    def preload_ootd_modules(self):
        """OOTDiffusion 모듈 미리 로드"""
        try:
            logger.info("OOTDiffusion 모듈 로딩 시작...")
            
            # 프로젝트 루트 경로
            project_root = Path(__file__).parent.parent.parent
            ootd_path = project_root / "app" / "api" / "ml_models" / "OOTDiffusion"
            ootd_run_path = ootd_path / "run"
            ootd_preprocess_path = ootd_path / "preprocess"
            
            # OOTDiffusion 경로가 존재하는지 확인
            if not ootd_run_path.exists():
                logger.warning(f"OOTDiffusion run 경로를 찾을 수 없습니다: {ootd_run_path}")
                return
            
            if not ootd_preprocess_path.exists():
                logger.warning(f"OOTDiffusion preprocess 경로를 찾을 수 없습니다: {ootd_preprocess_path}")
                return
            
            # Python 경로에 OOTDiffusion 디렉토리들 추가
            sys.path.insert(0, str(ootd_run_path))
            sys.path.insert(0, str(ootd_preprocess_path))
            sys.path.insert(0, str(ootd_preprocess_path / "humanparsing"))
            
            # 필요한 모듈들 미리 import 시도
            try:
                # onnxruntime 로드 테스트 및 최적화 설정
                import onnxruntime as ort
                
                # ONNX Runtime 최적화 설정
                ort.set_default_logger_severity(3)  # 로그 레벨 낮춤
                
                # 메모리 최적화를 위한 세션 옵션 설정
                session_options = ort.SessionOptions()
                session_options.intra_op_num_threads = 1  # 내부 연산 스레드 수 제한
                session_options.inter_op_num_threads = 1  # 외부 연산 스레드 수 제한
                session_options.execution_mode = ort.ExecutionMode.ORT_PARALLEL  # 병렬 실행 모드
                session_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC  # 기본 최적화만
                
                # 메모리 할당 전략 설정
                session_options.enable_mem_pattern = False  # 메모리 패턴 비활성화
                session_options.enable_cpu_mem_arena = False  # CPU 메모리 아레나 비활성화
                
                logger.info(f"onnxruntime 로드 성공: {ort.__version__}")
                logger.info("ONNX Runtime 메모리 최적화 설정 적용됨")
                
                # OOTDiffusion 관련 모듈들 로드 시도
                import importlib.util
                
                # run_ootd.py 모듈 로드
                run_ootd_spec = importlib.util.spec_from_file_location(
                    "run_ootd", 
                    ootd_run_path / "run_ootd.py"
                )
                if run_ootd_spec and run_ootd_spec.loader:
                    run_ootd_module = importlib.util.module_from_spec(run_ootd_spec)
                    run_ootd_spec.loader.exec_module(run_ootd_module)
                    logger.info("run_ootd 모듈 로드 성공")
                
                self.ootd_loaded = True
                logger.info("OOTDiffusion 모듈 로드 완료")
                
            except ImportError as e:
                logger.warning(f"모듈 import 실패 (정상 작동 가능): {e}")
                # import 실패해도 subprocess로 실행되므로 계속 진행
                self.ootd_loaded = True
                
            except Exception as e:
                logger.error(f"OOTDiffusion 모듈 로드 중 오류: {e}")
                # 오류가 있어도 subprocess로 실행되므로 계속 진행
                self.ootd_loaded = True
                
        except Exception as e:
            logger.error(f"OOTDiffusion 모듈 로드 실패: {e}")
            # 로드 실패해도 subprocess로 실행되므로 계속 진행
            self.ootd_loaded = True
    
    def process_task(self, task: Dict[str, Any]) -> bool:
        """작업 처리"""
        task_type = task.get("type")
        task_id = task.get("id")
        
        logger.info(f"작업 처리 시작: {task_id} (타입: {task_type})")
        
        # 메모리 사용량 로깅
        process = psutil.Process()
        memory_info = process.memory_info()
        logger.info(f"작업 시작 전 메모리 사용량: {memory_info.rss / 1024 / 1024:.2f} MB")
        
        try:
            if task_type == "virtual_fitting":
                # 가상 피팅 작업 처리
                success = fitting_service_redis.process_virtual_fitting_task(task["data"])
                
                if success:
                    task_queue.update_task_status(task_id, "COMPLETED")
                    logger.info(f"작업 완료: {task_id}")
                else:
                    task_queue.update_task_status(task_id, "FAILED", {"error": "처리 실패"})
                    logger.error(f"작업 실패: {task_id}")
                
                # 가비지 컬렉션 강제 실행
                gc.collect()
                
                # 작업 완료 후 메모리 사용량 로깅
                memory_info = process.memory_info()
                logger.info(f"작업 완료 후 메모리 사용량: {memory_info.rss / 1024 / 1024:.2f} MB")
                
                return success
            else:
                logger.warning(f"알 수 없는 작업 타입: {task_type}")
                task_queue.update_task_status(task_id, "FAILED", {"error": "알 수 없는 작업 타입"})
                return False
                
        except Exception as e:
            logger.error(f"작업 처리 중 오류 발생: {e}")
            task_queue.update_task_status(task_id, "FAILED", {"error": str(e)})
            # 오류 발생 시에도 가비지 컬렉션 실행
            gc.collect()
            return False
    
    def run(self):
        """워커 실행"""
        logger.info("가상 피팅 워커 시작")
        
        # 워커 시작 시 정리 작업 수행
        try:
            # 처리 중인 작업들 정리 (재시작 시)
            cleared_processing = task_queue.clear_processing_tasks()
            if cleared_processing > 0:
                logger.info(f"처리 중인 작업 {cleared_processing}개 정리됨")
            
            # 실패한 작업들 정리
            cleared_failed = task_queue.clear_failed_tasks()
            if cleared_failed > 0:
                logger.info(f"실패한 작업 {cleared_failed}개 정리됨")
                
        except Exception as e:
            logger.error(f"작업 정리 중 오류: {e}")
        
        # OOTDiffusion 모듈 로드 상태 확인
        if self.ootd_loaded:
            logger.info("OOTDiffusion 모듈 로드 완료 - 작업 대기 중...")
        else:
            logger.warning("OOTDiffusion 모듈 로드 실패 - subprocess 모드로 실행")
        
        while self.running:
            try:
                # 큐에서 작업 가져오기 (10초 타임아웃)
                task = task_queue.dequeue_task(timeout=10)
                
                if task:
                    self.process_task(task)
                else:
                    # 작업이 없으면 잠시 대기
                    time.sleep(1)
                    
            except KeyboardInterrupt:
                logger.info("키보드 인터럽트로 종료")
                break
            except Exception as e:
                logger.error(f"워커 실행 중 오류: {e}")
                time.sleep(5)  # 오류 발생 시 5초 대기
        
        logger.info("가상 피팅 워커 종료")

def main():
    """워커 메인 함수"""
    worker = VirtualFittingWorker()
    worker.run()

if __name__ == "__main__":
    main()
