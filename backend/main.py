from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.sessions import SessionMiddleware
import os
import logging
from dotenv import load_dotenv

from app.models import * # 테이블 생성용
from app.db.database import SessionLocal, engine, get_db
# from app.db.create_tables import create_tables # 테이블 생성 함수

# 라우터 임포트
from app.api.routes import auth_router
from app.api.routes import register_router
from app.api import kakao_auth_router
from app.api.routes import clothing_items_router
from app.api.routes import liked_clothes_router
from app.api.routes import feeds_router
from app.api.routes import comments_router
from app.api import user_profiles_router
from app.api import follow_system_router
from app.api.routes import user_profile_router # 사용자 프로필 수정정
from app.api.routes import person_images_router
from app.api.routes import user_clothes_router
from app.api.routes import virtual_fitting_router

# 환경 변수 로드
load_dotenv()

# 데이터베이스 테이블 생성
# Base.metadata.drop_all(bind=engine) # 기존 테이블 삭제(테스트용)
Base.metadata.create_all(bind=engine)

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Virtual Fitting API",
    description="가상 피팅 서비스를 위한 API",
    version="0.1.0"
)

# UTF-8 인코딩 설정
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

class UTF8Middleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        if isinstance(response, JSONResponse):
            response.headers["Content-Type"] = "application/json; charset=utf-8"
        return response

app.add_middleware(UTF8Middleware)

# 세션 미들웨어 추가 (비밀 키 설정)
app.add_middleware(SessionMiddleware, secret_key="your_secret_key")

# CORS 설정
origins = [
    "http://localhost:3000",    # React 프론트엔드
    "http://localhost:5173",    # Vite 사용 시
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # 허용할 도메인 목록
    #allow_origins=["*"],  # 모든 도메인에서 요청을 허용
    allow_credentials=True,
    allow_methods=["*"],  # 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
)

# 정적 파일 제공을 위한 디렉토리 생성
os.makedirs("uploads/profile_pictures", exist_ok=True)
os.makedirs("uploads/feeds", exist_ok=True)

# CORS 헤더가 포함된 정적 파일 서빙을 위한 커스텀 클래스
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.requests import Request

class CORSStaticFiles(StaticFiles):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
    
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            request = Request(scope, receive)
            path = request.url.path
            
            # 이미지 파일인 경우 CORS 헤더 추가
            if any(path.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.webp', '.gif']):
                async def send_with_cors(message):
                    if message["type"] == "http.response.start":
                        message["headers"].extend([
                            (b"Access-Control-Allow-Origin", b"http://localhost:3000"),
                            (b"Access-Control-Allow-Methods", b"GET, OPTIONS"),
                            (b"Access-Control-Allow-Headers", b"*"),
                            (b"Access-Control-Allow-Credentials", b"true"),
                        ])
                    await send(message)
                
                await super().__call__(scope, receive, send_with_cors)
                return
        
        await super().__call__(scope, receive, send)

# 정적 파일 제공 (CORS 헤더 포함)
app.mount("/uploads", CORSStaticFiles(directory="uploads"), name="uploads")

# 이미지 프록시 엔드포인트 (CORS 문제 해결용)
@app.get("/api/proxy-image/{image_path:path}")
async def proxy_image(image_path: str):
    """이미지를 프록시하여 CORS 문제를 해결합니다."""
    try:
        # 보안을 위해 uploads 디렉토리 내의 파일만 허용
        if not image_path.startswith("uploads/"):
            image_path = f"uploads/{image_path}"
        
        # 파일 존재 확인
        if not os.path.exists(image_path):
            raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
        
        # 이미지 파일 확장자 확인
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
        file_ext = os.path.splitext(image_path)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")
        
        return FileResponse(
            image_path,
            media_type=f"image/{file_ext[1:]}",
            headers={
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": "true",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"이미지 로드 실패: {str(e)}")

# 라우터 등록
app.include_router(auth_router)
app.include_router(register_router)
app.include_router(kakao_auth_router)
app.include_router(clothing_items_router)
app.include_router(liked_clothes_router)
app.include_router(user_profile_router)
app.include_router(person_images_router)
app.include_router(user_clothes_router)

app.include_router(feeds_router)
app.include_router(comments_router)

app.include_router(user_profiles_router)
app.include_router(follow_system_router)

app.include_router(virtual_fitting_router)

# 서버 상태 확인 엔드포인트
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# 루트 엔드포인트
@app.get('/')
async def root():
    return {"message": "Welcome to Virtual Fitting API"}


#print("🔥 app in main:", id(app))