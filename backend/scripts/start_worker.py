#!/usr/bin/env python3
"""
가상 피팅 워커 시작 스크립트
"""

import sys
import os
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# OOTDiffusion 모듈 경로 추가
ootd_path = project_root / "app" / "api" / "ml_models" / "OOTDiffusion"
ootd_run_path = ootd_path / "run"
ootd_preprocess_path = ootd_path / "preprocess"
ootd_humanparsing_path = ootd_preprocess_path / "humanparsing"

# Python 경로에 OOTDiffusion 디렉토리들 추가
sys.path.insert(0, str(ootd_run_path))
sys.path.insert(0, str(ootd_preprocess_path))
sys.path.insert(0, str(ootd_humanparsing_path))

# 환경변수 로드
from dotenv import load_dotenv
load_dotenv()

# 도커 환경에서 Redis 호스트 설정 (환경변수가 없으면 기본값 사용)
if not os.getenv('REDIS_HOST'):
    # 로컬에서 실행할 때는 도커 컨테이너의 Redis에 연결
    if os.path.exists('/.dockerenv'):
        os.environ['REDIS_HOST'] = 'redis'
    else:
        os.environ['REDIS_HOST'] = 'localhost'  # 도커 Redis는 localhost:6379로 접근 가능
if not os.getenv('REDIS_PORT'):
    os.environ['REDIS_PORT'] = '6379'

# MySQL 연결 설정 (로컬에서 실행할 때는 포트 3308 사용)
if not os.getenv('MYSQL_HOST'):
    if os.path.exists('/.dockerenv'):
        os.environ['MYSQL_HOST'] = 'mysql'
    else:
        os.environ['MYSQL_HOST'] = 'localhost'
if not os.getenv('MYSQL_PORT'):
    if os.path.exists('/.dockerenv'):
        os.environ['MYSQL_PORT'] = '3306'
    else:
        os.environ['MYSQL_PORT'] = '3308'

print(f"MySQL 설정: {os.getenv('MYSQL_HOST')}:{os.getenv('MYSQL_PORT')}")
print(f"Redis 설정: {os.getenv('REDIS_HOST')}:{os.getenv('REDIS_PORT')}")

# 데이터베이스 연결 URL 디버깅
from app.db.database import DB_URL
print(f"데이터베이스 연결 URL: {DB_URL}")

# 워커 실행
from app.workers.virtual_fitting_worker import main

if __name__ == "__main__":
    print("가상 피팅 워커를 시작합니다...")
    main()
