@echo off
chcp 65001 >nul
rem 메모 플래너 시작 버튼 (Windows)
rem 더블클릭하면 http://localhost:3000 에서 앱이 열려요. 끄려면 이 창을 닫으세요.
rem 처음 한 번은 AI용 패키지를 자동으로 설치해요 (인터넷 필요).
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python을 찾을 수 없어요. https://www.python.org 에서 설치한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo 처음 실행이라 AI용 패키지를 설치하고 있어요... 1~2분
  python -m venv .venv
)
".venv\Scripts\python.exe" -c "import anthropic" >nul 2>nul
if errorlevel 1 (
  ".venv\Scripts\python.exe" -m pip install -q anthropic
  if errorlevel 1 echo AI 패키지 설치에 실패했어요. 메모와 캘린더는 그대로 쓸 수 있어요.
)

set PY=.venv\Scripts\python.exe
if not exist "%PY%" set PY=python
start "" cmd /c "timeout /t 1 >nul & start http://localhost:3000"
"%PY%" server.py
