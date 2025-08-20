# 안양대학교 캡스톤 디자인
AI 기반 가상 피팅 서비스 + 사용자 피드 기능이 포함된 풀스택 웹 프로젝트입니다.

***

## ✅ 공통 환경 ( 수정 필요 )
|항목|버전|
|:-----:|:-----:|
|OS|Windows 10 / 11|
|Python|3.11|
|Node.js|18.18.0|
|npm|9.8.1|
|CUDA|10.1|

pip	최신 권장 (pip install --upgrade pip)

***

## 📁 프로젝트 구조
```bash
project-root/
├── frontend/     # React 기반 프론트엔드
├── backend/      # FastAPI 기반 백엔드
├── .env          # (선택) 환경변수 설정
```

***

## ✅ 실행 방법
### 1️⃣ Redis 서버 실행
```bash
# Redis Docker 이미지 다운로드
docker pull redis

# Redis 서버 실행(포트 6379)
docker run -p 6379:6379 redis

cd backend/scripts
# 워커 실행
python scripts/start_worker.py
```

***

### 2️⃣ AI 모델 설치 (필수)
OOTDiffusion 모델을 다음 경로에 설치해야 합니다:
```
backend/app/api/ml_models/OOTDiffusion/
```
OOTDiffusion 모델 파일은 용량이 크므로 별도로 다운로드하여 위 경로에 배치

***

### 3️⃣ Frontend (React)
```bash
# 1. frontend 디렉토리로 이동
cd frontend

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm start
```

### 💡 ``.env`` 파일 설정 (React용)
``frontend/`` 폴더 안에 ``.env`` 파일을 생성:
```bash
# 백엔드 API URL
REACT_APP_API_URL=http://localhost:8000

# 카카오 OAuth 설정 (프론트엔드용)
REACT_APP_KAKAO_JAVASCRIPT_KEY=your-kakao-javascript-key
REACT_APP_KAKAO_REDIRECT_URI=http://localhost:3000/auth/kakao/callback
```

***

## 4️⃣ Backend (FastAPI)
```bash
# 1. backend 디렉토리로 이동
cd backend

# 2. 가상환경 생성
python -m venv venv

# 3. 가상환경 활성화 (Windows CMD 기준)
venv\Scripts\activate.bat

# 4. 의존성 설치
cd backend
pip install -r requirements.txt

# 5. 개발 서버 실행
uvicorn main:app --reload --port 8000
```

### 🛠 백엔드 .env
``.env`` 파일을 ``backend/`` 내부에 생성하고 아래처럼 작성합니다:
```bash
# 데이터베이스 설정
DB_USER=root
DB_PASSWORD=123456
DB_HOST=localhost
DB_PORT=3307
DB_NAME=capstone

# 카카오 API 설정
KAKAO_CLIENT_ID=your-kakao-client-id # 카카오 앱의 REST API 키
KAKAO_JAVASCRIPT_KEY=your-kakao-javascript-key # 카카오 앱의 JavaScript 키
KAKAO_CLIENT_SECRET=your-kakao-client-secret # 카카오 앱의 클라이언트 시크릿 키
KAKAO_REDIRECT_URI=http://localhost:3000/oauth/kakao/callback

# SMTP 설정
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_password  # Google 앱 비밀번호

# 앱 설정
BASE_URL=http://localhost:8000
SECRET_KEY=your-secret-key-for-token-generation

DEV_MODE=false
```

***

## 👨‍💻 만든 사람들
| 이름 | 역할 | GitHub |
|-----|------|--------|
|김선빈|...|...|
|이규현|...|...|
|정현구|...|...|

> 📌 안양대학교 소프트웨어학과 2025 캡스톤 디자인 팀 - **Fashiony Guys**

---

# 🚀 WANGJUN Version

## 📋 추가된 기능 및 개선사항

### ✨ **새로운 기능들**
- **가상 피팅 결과 관리**: 생성된 가상 피팅 이미지들의 제목 수정, 미리보기, 다운로드 기능
- **마이페이지 가상 피팅 탭**: 개인별 가상 피팅 히스토리 관리
- **크롤링 데이터 통합**: 외부 의류 데이터를 시스템에 통합하여 가상 피팅에 활용
- **홈/의류 페이지 연동**: 추천 상품과 의류 페이지에서 직접 가상 피팅으로 이동 가능
- **좋아요한 의류 연동**: 마이페이지 좋아요한 의류에서 가상 피팅 기능 사용 가능

### 🔧 **기술적 개선사항**
- **CORS 오류 해결**: 외부 이미지 로딩 시 발생하는 CORS 문제를 URL 파라미터 방식으로 우회
- **OOTDiffusion 모델 최적화**: 마스킹 로직 개선 및 성능 최적화
- **Docker 환경 개선**: 크롤링 데이터 폴더 추가 및 환경 설정 최적화
- **프론트엔드 UI/UX 개선**: 가상 피팅 결과 화면 및 마이페이지 인터페이스 개선

### 🐛 **버그 수정**
- **가상 피팅 결과 화면**: 4개 이미지 모두 표시되도록 수정
- **이미지 로딩 문제**: 외부 이미지 URL 처리 로직 개선
- **타이틀 동기화**: 마이페이지와 메인 페이지 간 제목 동기화

---

## 🛠 **WANGJUN Version 설치 및 실행 가이드**

### **1️⃣ 필수 요구사항**
```bash
# 기존 요구사항 + 추가
- Docker & Docker Compose
- CUDA 지원 GPU (가상 피팅 AI 모델용)
- 최소 16GB RAM (AI 모델 로딩용)
- 최소 50GB 여유 디스크 공간 (모델 파일 + 이미지 저장용)
```

### **2️⃣ OOTDiffusion 모델 설치 (필수)**
```bash
# 1. OOTDiffusion 모델 다운로드
# GitHub: https://github.com/levihsu/OOTDiffusion

# 2. 모델 파일을 다음 경로에 배치
backend/app/api/ml_models/OOTDiffusion/

# 3. 필요한 모델 파일들:
# - checkpoints/ (모델 체크포인트)
# - clip-vit-large-patch14/ (CLIP 모델)
# - pipelines_ootd/ (파이프라인 파일들)
# - utils_ootd.py (유틸리티 함수)
```

### **3️⃣ Docker 환경으로 실행 (권장)**
```bash
# 1. 프로젝트 클론
git clone https://github.com/KIMWANGJUN/VirtualFitting-WANGJUN.git
cd VirtualFitting-WANGJUN

# 2. OOTDiffusion 모델 파일 배치 (위 2번 참조)

# 3. 환경 변수 파일 생성
# backend/.env 파일 생성 (기존 가이드 참조)

# 4. Docker 컨테이너 빌드 및 실행
docker-compose build --no-cache
docker-compose up -d

# 5. 서비스 확인
# Frontend: http://localhost:3000
# Backend: http://localhost:8000
# Database: localhost:3307
```

### **4️⃣ 수동 설치 방법**
```bash
# Frontend
cd frontend
npm install
npm start

# Backend
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Worker (별도 터미널)
cd backend
python scripts/start_worker.py
```

---

## 📁 **WANGJUN Version 프로젝트 구조**
```
VirtualFitting-WANGJUN/
├── frontend/                    # React 프론트엔드
│   ├── src/pages/
│   │   ├── VirtualFittingPage/     # 가상 피팅 메인 페이지
│   │   ├── VirtualFittingResultPage/ # 결과 선택 페이지
│   │   ├── VirtualFittingMainPage/   # 저장된 결과 목록
│   │   └── MyPage/                   # 마이페이지 (가상 피팅 탭)
│   └── src/components/
├── backend/                     # FastAPI 백엔드
│   ├── app/api/ml_models/OOTDiffusion/  # AI 모델 (별도 설치 필요)
│   ├── app/api/routes/virtual_fitting.py # 가상 피팅 API
│   ├── app/utils/virtual_fitting_service.py # 가상 피팅 서비스
│   ├── app/workers/virtual_fitting_worker.py # AI 워커
│   └── crawling/                # 크롤링 데이터
├── docker-compose.yml           # Docker 설정
└── README.md                    # 이 파일
```

---

## 🔧 **환경 변수 설정 (WANGJUN Version)**

### **전역 (.env) - 루트 디렉토리**
```bash
# 이메일 설정
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=your_email@gmail.com
EMAIL_USE_TLS=true
EMAIL_USE_SSL=false
```

### **Frontend (.env) - frontend 디렉토리**
```bash
REACT_APP_API_URL=http://localhost:8000
GENERATE_SOURCEMAP=false
```

### **Backend (.env) - backend 디렉토리**
```bash
# 데이터베이스 설정
DB_USER=root
DB_PASSWORD=123456
DB_HOST=mysql_db  # Docker 환경에서는 서비스명 사용
DB_PORT=3306      # Docker 환경에서는 3306 사용
DB_NAME=capstone

# 카카오 API 설정
KAKAO_CLIENT_ID=your-kakao-client-id
KAKAO_JAVASCRIPT_KEY=your-kakao-javascript-key
KAKAO_CLIENT_SECRET=your-kakao-client-secret
KAKAO_REDIRECT_URI=http://localhost:3000/oauth/kakao/callback

# SMTP 설정
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USERNAME=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# 앱 설정
BASE_URL=http://localhost:8000
SECRET_KEY=your-secret-key-for-token-generation
DEV_MODE=false
```

---

## 🚨 **주의사항 (WANGJUN Version)**

### **1️⃣ OOTDiffusion 모델**
- **용량**: 약 10GB+ (모델 파일들)
- **GPU**: CUDA 지원 GPU 필수
- **메모리**: 최소 8GB GPU 메모리 권장
- **설치**: GitHub에서 별도 다운로드 필요

### **2️⃣ 성능 최적화**
- **첫 실행**: 모델 로딩에 5-10분 소요
- **가상 피팅**: 이미지당 2-5분 소요 (GPU 성능에 따라)
- **메모리 관리**: 사용 후 CUDA 캐시 정리 권장

### **3️⃣ 데이터베이스**
- **크롤링 데이터**: 초기 데이터는 자동으로 로드됨
- **백업**: 정기적인 데이터베이스 백업 권장

### **4️⃣ 환경 변수 파일**
- **전역 .env**: 루트 디렉토리에 이메일 설정
- **Frontend .env**: frontend 디렉토리에 API URL 설정
- **Backend .env**: backend 디렉토리에 데이터베이스, API 설정
- **보안**: 실제 값은 GitHub에 업로드하지 않음 (.gitignore에 포함)

### **5️⃣ 프로젝트 용량**
- **전체 프로젝트**: 약 23GB (AI 모델 포함)
- **GitHub 업로드**: 약 500MB (소스 코드만)
- **제외 파일들**: node_modules, venv, AI 모델, 업로드 이미지

---

## 🐛 **문제 해결 (WANGJUN Version)**

### **가상 피팅이 원본 이미지만 출력하는 경우**
```bash
# 1. CUDA 캐시 정리
nvidia-smi --gpu-reset

# 2. 모델 파일 확인
ls backend/app/api/ml_models/OOTDiffusion/

# 3. 로그 확인
docker-compose logs virtual_fitting_worker
```

### **외부 이미지 로딩 오류**
```bash
# CORS 오류는 URL 파라미터 방식으로 해결됨
# 좋아요한 의류 → 가상 피팅 버튼 사용
```

### **Docker 컨테이너 문제**
```bash
# 전체 재빌드
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **환경 변수 파일 문제**
```bash
# 1. 모든 .env 파일이 올바른 위치에 있는지 확인
# - 루트 디렉토리: .env (이메일 설정)
# - frontend 디렉토리: .env (API URL)
# - backend 디렉토리: .env (데이터베이스, API)

# 2. 파일 권한 확인 (Linux/Mac)
chmod 600 .env
chmod 600 frontend/.env
chmod 600 backend/.env
```

### **크롤링 데이터 로드 문제**
```bash
# 1. 데이터베이스 연결 확인
docker-compose logs mysql_db

# 2. 크롤링 데이터 수동 삽입
docker-compose exec backend python crawling/insert_csv.py
```

---

## 📞 **지원 및 문의**

**개발자**: 김왕준 (KIMWANGJUN)  
**GitHub**: https://github.com/KIMWANGJUN  
**프로젝트**: https://github.com/KIMWANGJUN/VirtualFitting-WANGJUN

## 📋 **업데이트 로그 (WANGJUN Version)**

### **v1.0.0 (2024-12-19)**
- ✅ 가상 피팅 결과 관리 기능 추가
- ✅ 마이페이지 가상 피팅 탭 구현
- ✅ 크롤링 데이터 통합
- ✅ 홈/의류 페이지 연동
- ✅ CORS 오류 해결
- ✅ OOTDiffusion 모델 최적화
- ✅ Docker 환경 개선
- ✅ UI/UX 개선

### **v1.1.0 (2024-12-19)**
- ✅ 환경 변수 설정 문서화 완료
- ✅ 문제 해결 가이드 추가
- ✅ 프로젝트 용량 정보 추가

> 📌 **WANGJUN Version**은 기존 Fashiony Guys 팀의 프로젝트를 기반으로 개선된 버전입니다.