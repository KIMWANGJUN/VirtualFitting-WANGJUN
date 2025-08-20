# 빌드 스테이지
FROM python:3.11 as builder

# MySQL, 시스템 라이브러리, 개발 패키지 설치
RUN apt-get update && apt-get install -y \
    pkg-config \
    default-libmysqlclient-dev \
    libmariadb-dev \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglu1-mesa \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libopenblas-dev \
    gfortran \
    wget \
    git \
    patchelf \
    && rm -rf /var/lib/apt/lists/*

# pip 최신화
RUN python -m pip install --upgrade pip setuptools wheel

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# ONNX Runtime 실행 스택 문제 해결
RUN find /usr/local/lib/python*/site-packages/onnxruntime -name "*.so" -exec patchelf --clear-execstack {} \; || true

# 실행 스테이지
FROM python:3.11-slim

# 런타임 시스템 패키지만 설치
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libglu1-mesa \
    libgtk-3-0 \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libopenblas-dev \
    && rm -rf /var/lib/apt/lists/*

# 환경 변수 설정
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99

WORKDIR /app

# 빌드된 Python 패키지 복사
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY ./app ./app
COPY ./scripts ./scripts
COPY ./crawling ./crawling
COPY main.py .

# 실제 워커(예: FastAPI 앱) 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
