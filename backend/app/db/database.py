from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# MySQL 연결 정보를 환경 변수에서 가져오기 (DB_* 우선, 없으면 MYSQL_* 사용)
DB_USER = os.getenv("DB_USER") or os.getenv("MYSQL_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD") or os.getenv("MYSQL_PASSWORD", "123456")
DB_HOST = os.getenv("DB_HOST") or os.getenv("MYSQL_HOST", "mysql")
DB_PORT = os.getenv("DB_PORT") or os.getenv("MYSQL_PORT", "3306")
DB_NAME = os.getenv("DB_NAME") or os.getenv("MYSQL_DATABASE", "capstone")

# MySQL 데이터베이스 연결 URL
DB_URL = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

# SQLAlchemy 엔진 생성
engine = create_engine(DB_URL, pool_pre_ping=True)

# 세션 만들기
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스 생성 (모든 모델은 이 클래스를 상속)
Base = declarative_base()

# 의존성: 데이터베이스 세션 가져오기
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()