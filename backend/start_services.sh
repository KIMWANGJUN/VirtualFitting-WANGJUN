#!/bin/bash

# 환경변수 설정
if [ -z "$REDIS_HOST" ]; then
    export REDIS_HOST=redis
fi
if [ -z "$REDIS_PORT" ]; then
    export REDIS_PORT=6379
fi

echo "Redis 설정: $REDIS_HOST:$REDIS_PORT"

# 워커를 백그라운드에서 시작
echo "워커 서비스를 시작합니다..."
python scripts/start_worker.py &

# 백엔드 서버 시작
echo "백엔드 서버를 시작합니다..."
uvicorn main:app --host 0.0.0.0 --port 8000
