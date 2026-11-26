#!/bin/bash
# 메모 플래너를 '더블클릭으로 켜는 앱(MemoMate.app)'으로 만드는 파일 (Mac)
# 더블클릭하면 몇 분 뒤 dist/MemoMate.app 이 만들어져요. (인터넷 필요)
# 패키지는 이 폴더의 .venv 안에만 설치돼요.

cd "$(dirname "$0")" || exit 1

pause_exit() {
  read -n 1 -s -r -p "아무 키나 누르면 창이 닫혀요."
  exit "$1"
}

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 을 찾을 수 없어요."
  echo "터미널에서 xcode-select --install 을 실행해 설치한 뒤 다시 시도해 주세요."
  pause_exit 1
fi

if [ ! -x ".venv/bin/python" ]; then
  echo "[1/3] 전용 Python 공간(.venv)을 만들고 있어요..."
  python3 -m venv .venv || { echo "⚠ .venv 만들기에 실패했어요."; pause_exit 1; }
fi

echo "[1/3] 필요한 패키지를 설치하고 있어요... (처음엔 1~3분)"
.venv/bin/python -m pip install -q -r requirements.txt pyinstaller \
  || { echo "⚠ 패키지 설치에 실패했어요. 인터넷 연결을 확인하고 다시 실행해 주세요."; pause_exit 1; }

echo "[2/3] 앱을 만들고 있어요... (2~5분, 글자가 많이 지나가도 정상이에요)"
.venv/bin/python -m PyInstaller --noconfirm --clean memomate.spec \
  || { echo "⚠ 앱 만들기에 실패했어요. 위쪽 오류 문구를 개발자에게 보여 주세요."; pause_exit 1; }

if [ ! -d "dist/MemoMate.app" ]; then
  echo "⚠ dist/MemoMate.app 을 찾을 수 없어요."
  pause_exit 1
fi

echo "[3/3] 완료!"
echo ""
echo "  만들어진 앱: $(pwd)/dist/MemoMate.app"
echo "  - 더블클릭하면 브라우저에서 메모 플래너가 열려요."
echo "  - 처음 열 때 '확인되지 않은 개발자' 경고가 나오면: 앱을 우클릭 → 열기 → 열기"
echo "  - 끄려면: 화면의 종료 버튼"
echo "  - AI 키(.env)는 ~/Library/Application Support/MemoMate/ 폴더에 둬요."
open dist
pause_exit 0
