import os
import uuid
import asyncio
import subprocess
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from PIL import Image
import logging

from app.db.database import get_db, SessionLocal
from app.models.virtual_fitting_process import VirtualFittingProcess
from app.models.virtual_fittings import VirtualFittings
from app.crud.virtual_fitting import VirtualFittingCRUD
from app.core.task_queue import task_queue

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class VirtualFittingServiceRedis:
    def __init__(self):
        # 현재 프로젝트 루트 경로
        self.project_root = Path(__file__).parent.parent.parent
        
        # OOTDiffusion 모델 경로 설정
        self.ootd_model_path = self.project_root / "app" / "api" / "ml_models" / "OOTDiffusion" / "run"
        self.output_dir = self.project_root / "uploads" / "virtual_fitting_results"
        self.temp_dir = self.project_root / "uploads" / "temp_fitting"
        
        # 디렉토리 생성
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.temp_dir.mkdir(parents=True, exist_ok=True)
    
    async def start_virtual_fitting(
        self, 
        db: Session,
        user_id: int,
        model_image_path: str,
        cloth_image_path: str,
        category: int,
        model_type: str = "dc",
        scale: float = 2.0,
        samples: int = 4
    ) -> int:
        """가상 피팅 프로세스 시작 (Redis 큐 사용)"""
        
        # 한국 시간대 (KST = UTC+9)
        kst = timezone(timedelta(hours=9))
        
        # 처리 상태 레코드 생성
        process = VirtualFittingProcess(
            user_id=user_id,
            status='QUEUED',  # 큐에 대기 중 상태
            started_at=datetime.now(kst)
        )
        db.add(process)
        db.commit()
        db.refresh(process)
        
        logger.info(f"가상 피팅 프로세스 생성: {process.id}")
        
        # 작업 데이터 준비
        task_data = {
            "process_id": process.id,
            "user_id": user_id,
            "model_image_path": model_image_path,
            "cloth_image_path": cloth_image_path,
            "category": category,
            "model_type": model_type,
            "scale": scale,
            "samples": samples
        }
        
        # Redis 큐에 작업 추가
        task_id = task_queue.enqueue_task("virtual_fitting", task_data)
        
        if task_id:
            # 프로세스에 task_id 저장 (선택사항)
            process.error_message = f"task_id:{task_id}"  # 임시로 task_id 저장
            db.commit()
            logger.info(f"작업이 큐에 추가됨: {task_id}")
        else:
            # 큐 추가 실패 시 상태 업데이트
            process.status = 'FAILED'
            process.error_message = "작업 큐 추가 실패"
            process.completed_at = datetime.now(kst)
            db.commit()
            logger.error(f"작업 큐 추가 실패: {process.id}")
        
        return process.id
    
    def process_virtual_fitting_task(self, task_data: Dict[str, Any]) -> bool:
        """실제 가상 피팅 처리 (워커에서 실행)"""
        process_id = task_data["process_id"]
        
        db = SessionLocal()
        try:
            logger.info(f"가상 피팅 작업 시작: {process_id}")
            
            # 프로세스 상태를 PROCESSING으로 업데이트
            process = db.query(VirtualFittingProcess).filter(
                VirtualFittingProcess.id == process_id
            ).first()
            
            if not process:
                logger.error(f"프로세스를 찾을 수 없음: {process_id}")
                return False
            
            process.status = 'PROCESSING'
            db.commit()
            
            # 실제 가상 피팅 실행
            result_paths = self._run_ootd_diffusion(
                task_data["model_image_path"],
                task_data["cloth_image_path"],
                task_data["category"],
                task_data["model_type"],
                task_data["scale"],
                task_data["samples"]
            )
            
            if not result_paths:
                raise Exception("생성된 결과 이미지를 찾을 수 없습니다.")
            
            logger.info(f"결과 이미지 {len(result_paths)}개 생성됨")
            
            # 한국 시간대 (KST = UTC+9)
            kst = timezone(timedelta(hours=9))
            
            # 데이터베이스 업데이트
            process.status = 'COMPLETED'
            process.completed_at = datetime.now(kst)
            
            # 결과 이미지 경로 저장 (상대 경로로 저장)
            for i, relative_path in enumerate(result_paths):
                if i < 6:  # 최대 6개까지
                    # 상대 경로인지 다시 한번 확인
                    if relative_path.startswith('uploads/'):
                        setattr(process, f'result_image_{i+1}', relative_path)
                        logger.info(f"DB 저장: result_image_{i+1} = {relative_path}")
                    else:
                        # 만약 절대 경로가 들어왔다면 상대 경로로 변환
                        path_obj = Path(relative_path)
                        if 'uploads' in path_obj.parts:
                            # uploads 이후 부분만 추출
                            uploads_index = path_obj.parts.index('uploads')
                            relative_parts = path_obj.parts[uploads_index:]
                            corrected_path = '/'.join(relative_parts)
                            setattr(process, f'result_image_{i+1}', corrected_path)
                            logger.warning(f"절대 경로를 상대 경로로 수정: {relative_path} -> {corrected_path}")
                        else:
                            logger.error(f"올바르지 않은 경로 형식: {relative_path}")
            
            db.commit()
            logger.info(f"가상 피팅 완료: {process_id}")
            
            # 입력 이미지를 프로세스 보관 폴더에 복사해 둔 뒤 원본 임시 파일 정리
            try:
                self._persist_process_inputs(process_id, task_data["model_image_path"], task_data["cloth_image_path"])  # 보관
            except Exception as persist_err:
                logger.warning(f"입력 이미지 보관 실패(계속 진행): {persist_err}")
            self._cleanup_temp_files([
                task_data["model_image_path"],
                task_data["cloth_image_path"]
            ])
            
            return True
            
        except Exception as e:
            logger.error(f"가상 피팅 처리 중 오류 발생: {e}")
            
            # 에러 발생 시 상태 업데이트
            try:
                process = db.query(VirtualFittingProcess).filter(
                    VirtualFittingProcess.id == process_id
                ).first()
                
                if process:
                    # 한국 시간대 (KST = UTC+9)
                    kst = timezone(timedelta(hours=9))
                    
                    process.status = 'FAILED'
                    process.completed_at = datetime.now(kst)
                    process.error_message = str(e)[:1000]
                    db.commit()
                    logger.info(f"가상 피팅 실패 상태 업데이트: {process_id}")
            except Exception as db_error:
                logger.error(f"데이터베이스 업데이트 실패: {db_error}")
            
            return False
        
        finally:
            db.close()
    
    def _run_ootd_diffusion(
        self,
        model_image_path: str,
        cloth_image_path: str,
        category: int,
        model_type: str,
        scale: float,
        samples: int
    ) -> List[str]:  # List[Path]에서 List[str]로 변경
        """OOTDiffusion 실행"""
        
        # 경로 검증
        if not self.ootd_model_path.exists():
            raise FileNotFoundError(f"OOTDiffusion 모델 경로를 찾을 수 없습니다: {self.ootd_model_path}")
        
        run_ootd_path = self.ootd_model_path / "run_ootd.py"
        if not run_ootd_path.exists():
            raise FileNotFoundError(f"run_ootd.py 파일을 찾을 수 없습니다: {run_ootd_path}")
        
        # 고유한 출력 디렉토리 생성
        unique_id = str(uuid.uuid4())
        temp_output_dir = self.temp_dir / unique_id
        temp_output_dir.mkdir(parents=True, exist_ok=True)
        
        # 절대 경로로 변환
        model_image_abs = Path(model_image_path).resolve()
        cloth_image_abs = Path(cloth_image_path).resolve()
        
        logger.info(f"모델 이미지: {model_image_abs}")
        logger.info(f"의류 이미지: {cloth_image_abs}")
        
        # Python 실행 파일 경로
        python_executable = sys.executable
        
        # OOTDiffusion 실행 명령어 구성 (GPU 모드 활성화)
        cmd = [
            python_executable,
            str(run_ootd_path),
            "--gpu_id", "0",  # CUDA GPU 0 사용 (정수값)
            "--model_path", str(model_image_abs),
            "--cloth_path", str(cloth_image_abs),
            "--model_type", model_type,
            "--category", str(category),
            "--scale", str(scale),
            "--sample", str(samples)
        ]
        
        logger.info(f"실행 명령어: {' '.join(cmd)}")
        logger.info(f"작업 디렉토리: {self.ootd_model_path}")
        
        # subprocess 실행
        result = subprocess.run(
            cmd,
            cwd=str(self.ootd_model_path),
            capture_output=True,
            text=True,
            timeout=3000,  # 30분 타임아웃으로 연장
            shell=False,
            env=os.environ.copy()
        )
        
        logger.info(f"subprocess 반환 코드: {result.returncode}")
        logger.info(f"stdout: {result.stdout}")
        
        if result.stderr:
            logger.warning(f"stderr: {result.stderr}")
        
        if result.returncode != 0:
            raise Exception(f"OOTDiffusion 실행 실패 (코드: {result.returncode}): {result.stderr}")
        
        # 결과 이미지들을 최종 위치로 이동
        result_paths = self._move_result_images(unique_id, model_type, samples)
        
        # 임시 디렉토리 정리
        import shutil
        shutil.rmtree(temp_output_dir, ignore_errors=True)
        
        return result_paths

    def _persist_process_inputs(self, process_id: int, model_image_path: str, cloth_image_path: str) -> None:
        """프로세스별 입력 이미지(모델/의류)를 보관 디렉터리에 복사하고 인덱스 JSON 저장"""
        from pathlib import Path
        import shutil
        from PIL import Image
        import json

        base_dir = self.project_root / "uploads" / "process_inputs"
        files_dir = base_dir / "files"
        index_dir = base_dir / "index"
        files_dir.mkdir(parents=True, exist_ok=True)
        index_dir.mkdir(parents=True, exist_ok=True)

        # PNG로 표준화
        model_dst = files_dir / f"{process_id}_model.png"
        cloth_dst = files_dir / f"{process_id}_cloth.png"

        # 이미지 열어 PNG로 저장 (서로 다른 확장자 대비)
        try:
            Image.open(model_image_path).convert('RGB').save(model_dst)
        except Exception:
            shutil.copy2(model_image_path, model_dst)
        try:
            Image.open(cloth_image_path).convert('RGB').save(cloth_dst)
        except Exception:
            shutil.copy2(cloth_image_path, cloth_dst)

        # 인덱스 JSON 저장 (상대 경로)
        index_path = index_dir / f"{process_id}.json"
        payload = {
            "model": f"uploads/process_inputs/files/{process_id}_model.png",
            "cloth": f"uploads/process_inputs/files/{process_id}_cloth.png",
        }
        with open(index_path, 'w', encoding='utf-8') as f:
            json.dump(payload, f)
        logger.info(f"프로세스 입력 보관 완료: {payload}")
    
    def _move_result_images(self, unique_id: str, model_type: str, samples: int) -> List[str]:
        """결과 이미지들을 최종 위치로 이동 (상대 경로 반환)"""
        result_paths = []
        
        # OOTDiffusion 출력 디렉토리에서 이미지 찾기
        ootd_output_dir = self.ootd_model_path / "images_output"
        
        for i in range(samples):
            # 실제 생성된 파일명 확인 (dc 모델이 실행됨)
            source_path = ootd_output_dir / f"out_dc_{i}.png"
            
            if source_path.exists():
                
                # 최종 저장 경로 (절대 경로)
                filename = f"{unique_id}_result_{i}.png"
                dest_path = self.output_dir / filename
                
                # 파일 이동
                import shutil
                shutil.move(str(source_path), str(dest_path))
                
                # 상대 경로로 변환하여 저장 (DB에 저장될 경로) - 슬래시로 통일
                relative_path = f"uploads/virtual_fitting_results/{filename}"
                result_paths.append(relative_path)
            else:
                logger.warning(f"결과 이미지를 찾을 수 없음: {source_path}")
    
        logger.info(f"최종 반환할 상대 경로들: {result_paths}")
        return result_paths
    
    def _cleanup_temp_files(self, file_paths: List[str]):
        """임시 파일들 정리"""
        for file_path in file_paths:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"임시 파일 삭제: {file_path}")
            except Exception as e:
                logger.warning(f"임시 파일 삭제 실패: {e}")
    
    def get_fitting_status(self, db: Session, process_id: int, user_id: int) -> Optional[VirtualFittingProcess]:
        """가상 피팅 처리 상태 조회"""
        return db.query(VirtualFittingProcess).filter(
            VirtualFittingProcess.id == process_id,
            VirtualFittingProcess.user_id == user_id
        ).first()
    
    def select_fitting_result(
        self, 
        db: Session, 
        process_id: int, 
        user_id: int, 
        selected_image_index: int
    ) -> Optional[VirtualFittings]:
        """가상 피팅 결과 선택 및 저장 (작업 완료 후 프로세스 레코드 삭제)"""
        
        # 처리 상태 확인
        process = self.get_fitting_status(db, process_id, user_id)
        if not process or process.status != 'COMPLETED':
            return None
        
        # 선택된 이미지 경로 가져오기 (이미 상대 경로)
        selected_image_path = getattr(process, f'result_image_{selected_image_index}', None)
        if not selected_image_path:
            return None
        
        try:
            # 선택된 이미지를 최종 저장소로 복사
            final_image_path = self._copy_selected_image_to_final_location(
                selected_image_path, user_id
            )
            
            if not final_image_path:
                logger.error("선택된 이미지 복사 실패")
                return None
            
            # 결과와 함께 입력 이미지도 복사
            try:
                self._copy_inputs_alongside_result(process_id, final_image_path)
            except Exception as e:
                logger.warning(f"입력 동반 복사 실패(무시): {e}")

            # 원본 선택지들도 복사 (재선택 기능용)
            try:
                self._copy_original_options_alongside_result(process, final_image_path)
            except Exception as e:
                logger.warning(f"원본 선택지 복사 실패(무시): {e}")

            # 한국 시간대 (KST = UTC+9)
            kst = timezone(timedelta(hours=9))
            
            # 트랜잭션 시작
            # VirtualFittings 테이블에 저장 (최종 경로로 저장)
            fitting_result = VirtualFittings(
                user_id=user_id,
                fitting_image_url=final_image_path,  # 최종 저장 경로
                created_at=datetime.now(kst)
            )
            
            db.add(fitting_result)
            db.flush()  # ID 생성을 위해 flush (commit 전)
            
            # 프로세스 입력 보관물 정리
            try:
                self._cleanup_process_inputs(process_id)
            except Exception as e:
                logger.warning(f"프로세스 입력 정리 실패(무시): {e}")
            
            # VirtualFittingProcess 레코드 삭제
            db.delete(process)
            
            # 모든 변경사항 커밋
            db.commit()
            
            logger.info(f"가상 피팅 결과 선택 완료 및 프로세스 삭제: process_id={process_id}, fitting_id={fitting_result.fitting_id}")
            
            return fitting_result
            
        except Exception as e:
            # 오류 발생 시 롤백
            db.rollback()
            logger.error(f"가상 피팅 결과 선택 중 오류 발생: {e}")
            return None

    def _copy_inputs_alongside_result(self, process_id: int, final_image_path: str) -> None:
        """보관된 프로세스 입력 이미지를 결과 이미지와 같은 폴더에 _model/_cloth로 복사"""
        from pathlib import Path
        import shutil
        import json

        base_dir = self.project_root
        index_path = base_dir / "uploads" / "process_inputs" / "index" / f"{process_id}.json"
        if not index_path.exists():
            logger.warning(f"입력 인덱스 없음: {index_path}")
            return
        with open(index_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        model_rel = data.get("model")
        cloth_rel = data.get("cloth")
        if not model_rel or not cloth_rel:
            return
        model_src = base_dir / model_rel
        cloth_src = base_dir / cloth_rel

        result_abs = base_dir / final_image_path
        result_dir = result_abs.parent
        stem = Path(result_abs.name).stem  # without extension

        model_dst = result_dir / f"{stem}_model.png"
        cloth_dst = result_dir / f"{stem}_cloth.png"

        if model_src.exists():
            shutil.copy2(str(model_src), str(model_dst))
        if cloth_src.exists():
            shutil.copy2(str(cloth_src), str(cloth_dst))
        logger.info(f"입력 이미지 동반 복사 완료: {model_dst}, {cloth_dst}")

    def _copy_original_options_alongside_result(self, process: VirtualFittingProcess, final_image_path: str) -> None:
        """원본 선택지 이미지들을 결과 이미지와 같은 폴더에 _option_0, _option_1, ...로 복사"""
        from pathlib import Path
        import shutil

        final_path_obj = Path(self.project_root) / final_image_path
        result_stem = final_path_obj.stem

        # 모든 결과 이미지들을 원본 선택지로 복사
        for i in range(1, 7):  # result_image_1 ~ result_image_6
            original_image_path = getattr(process, f'result_image_{i}', None)
            if original_image_path:
                original_abs_path = Path(self.project_root) / original_image_path
                if original_abs_path.exists():
                    option_dst_path = final_path_obj.parent / f"{result_stem}_option_{i-1}.png"
                    try:
                        shutil.copy2(original_abs_path, option_dst_path)
                        logger.info(f"원본 선택지 복사: {original_abs_path} -> {option_dst_path}")
                    except Exception as e:
                        logger.warning(f"원본 선택지 복사 실패 (option {i-1}): {e}")

    def _cleanup_process_inputs(self, process_id: int) -> None:
        """프로세스 입력 보관물(index/json, files) 정리"""
        from pathlib import Path
        import os as _os
        base = self.project_root / "uploads" / "process_inputs"
        for p in [base / "files" / f"{process_id}_model.png", base / "files" / f"{process_id}_cloth.png", base / "index" / f"{process_id}.json"]:
            try:
                if p.exists():
                    _os.remove(str(p))
                    logger.info(f"입력 보관물 삭제: {p}")
            except Exception as e:
                logger.warning(f"보관물 삭제 실패: {e}")

    def _copy_selected_image_to_final_location(self, temp_image_path: str, user_id: int) -> Optional[str]:
        """선택된 이미지를 최종 저장소로 복사"""
        try:
            # 최종 저장 디렉토리 생성
            final_dir = self.project_root / "uploads" / "selected_fittings"
            final_dir.mkdir(parents=True, exist_ok=True)
            
            # 원본 파일 경로
            source_path = self.project_root / temp_image_path
            if not source_path.exists():
                logger.error(f"원본 이미지를 찾을 수 없음: {source_path}")
                return None
            
            # 최종 파일명 생성 (사용자 ID와 타임스탬프 포함)
            import time
            timestamp = int(time.time())
            filename = f"user_{user_id}_{timestamp}_{uuid.uuid4().hex[:8]}.png"
            final_path = final_dir / filename
            
            # 파일 복사
            import shutil
            shutil.copy2(str(source_path), str(final_path))
            
            # 상대 경로 반환
            relative_final_path = f"uploads/selected_fittings/{filename}"
            
            logger.info(f"선택된 이미지 복사 완료: {source_path} -> {final_path}")
            return relative_final_path
            
        except Exception as e:
            logger.error(f"선택된 이미지 복사 실패: {e}")
            return None

    def _cleanup_all_process_images(self, process: VirtualFittingProcess):
        """프로세스의 모든 이미지들 정리"""
        for i in range(1, 7):  # result_image_1 ~ result_image_6
            relative_path = getattr(process, f'result_image_{i}', None)
            if relative_path:
                # 상대 경로를 절대 경로로 변환
                absolute_path = self.project_root / relative_path
                if absolute_path.exists():
                    try:
                        os.remove(str(absolute_path))
                        logger.info(f"프로세스 이미지 삭제: {absolute_path}")
                    except Exception as e:
                        logger.warning(f"프로세스 이미지 삭제 실패: {e}")
    
    def _cleanup_unselected_images(self, process: VirtualFittingProcess, selected_index: int):
        """선택되지 않은 이미지들 정리"""
        for i in range(1, 7):  # result_image_1 ~ result_image_6
            if i != selected_index:
                relative_path = getattr(process, f'result_image_{i}', None)
                if relative_path:
                    # 상대 경로를 절대 경로로 변환
                    absolute_path = self.project_root / relative_path
                    if absolute_path.exists():
                        try:
                            os.remove(str(absolute_path))
                            logger.info(f"선택되지 않은 이미지 삭제: {absolute_path}")
                        except Exception as e:
                            logger.warning(f"이미지 삭제 실패: {e}")

# 전역 서비스 인스턴스
fitting_service_redis = VirtualFittingServiceRedis()
