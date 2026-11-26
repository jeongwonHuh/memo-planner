#!/bin/bash
# 메모 플래너 시작 버튼 (Mac)
# 더블클릭하면 http://localhost:3000 에서 앱이 열려요.
# 처음 한 번은 AI용 패키지를 자동으로 설치해요 (인터넷 필요, 1~2분).
# 끄려면 이 터미널 창을 닫거나 Control + C 를 누르세요.

cd "$(dirname "$0")" || exit 1
PORT=3000
URL="http://localhost:$PORT"

if lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "포트 $PORT 이 이미 켜져 있어요. 브라우저만 엽니다: $URL"
  echo "(예전 방식으로 켠 서버라면 ✨ AI가 동작하지 않아요. 그 터미널 창을 닫고 다시 실행해 주세요.)"
  open "$URL"
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 을 찾을 수 없어요."
  echo "터미널에서 xcode-select --install 을 실행해 설치한 뒤 다시 시도해 주세요."
  read -n 1 -s -r -p "아무 키나 누르면 창이 닫혀요."
  exit 1
fi

# AI용 전용 Python 공간(.venv)과 anthropic 패키지 준비
if [ ! -x ".venv/bin/python" ]; then
  echo "처음 실행이라 AI용 패키지를 설치하고 있어요… (1~2분)"
  python3 -m venv .venv
fi
if ! .venv/bin/python -c "import anthropic" >/dev/null 2>&1; then
  .venv/bin/python -m pip install -q anthropic \
    || echo "⚠ AI 패키지 설치에 실패했어요. 메모·캘린더는 그대로 쓸 수 있어요. (인터넷 연결 후 다시 실행)"
fi

PY=".venv/bin/python"
[ -x "$PY" ] || PY="python3"
(sleep 1; open "$URL") &
"$PY" server.py
