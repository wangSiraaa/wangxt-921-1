#!/bin/bash
set -e

PROJECT_DIR="/Users/mingyuan/workspace/sihuo/wangxtw3/921"
BACKEND_DIR="$PROJECT_DIR/backend"
SMOKE_TEST="$PROJECT_DIR/smoke-test/smoke.test.js"
LOG_FILE="/tmp/internship_backend_test.log"

cd "$BACKEND_DIR"
rm -rf data
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo "[1/4] 启动后端服务..."
node src/server.js > "$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "   PID: $BACKEND_PID"

for i in 1 2 3 4 5; do
  sleep 2
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "   服务已就绪 ✓"
    break
  fi
  echo "   等待服务启动... ($i/5)"
done

echo ""
echo "[2/4] 健康检查..."
HEALTH=$(curl -s http://localhost:3000/api/health)
echo "   响应: $HEALTH"

echo ""
echo "[3/4] 运行 Smoke 测试 (3个核心场景)..."
echo "======================================================================"
node "$SMOKE_TEST" || true
SMOKE_EXIT=$?
echo "======================================================================"

echo ""
echo "[4/4] 后端日志 (最后20行)..."
tail -20 "$LOG_FILE"

echo ""
echo "清理进程 PID=$BACKEND_PID..."
kill $BACKEND_PID 2>/dev/null || true
sleep 1
kill -9 $BACKEND_PID 2>/dev/null || true
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true

echo ""
echo "=================================="
if [ $SMOKE_EXIT -eq 0 ]; then
  echo "✅ Smoke 测试全部通过"
  exit 0
else
  echo "❌ Smoke 测试存在失败（退出码: $SMOKE_EXIT）"
  exit $SMOKE_EXIT
fi
