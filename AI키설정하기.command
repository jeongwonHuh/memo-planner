#!/bin/bash
# 메모 플래너 AI 키 설정 (Mac)
# Anthropic Console에서 발급한 API 키를 붙여 넣으면 이 폴더의 .env 파일에 저장해요.
# 키는 입력해도 화면에 보이지 않아요. 키를 채팅이나 다른 사람에게 보내지 마세요.

cd "$(dirname "$0")" || exit 1
echo "=========================================="
echo "  ✨ 메모 플래너 AI 키 설정"
echo "=========================================="
echo "Anthropic Console(platform.claude.com) > API Keys 에서 만든 키를"
echo "붙여 넣고(⌘V) Enter 를 누르세요. 입력 내용은 화면에 보이지 않아요."
echo "(그냥 Enter 를 누르면 아무것도 바꾸지 않고 끝나요)"
echo
read -r -s -p "API 키: " KEY
echo
KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"

if [ -z "$KEY" ]; then
  echo "입력이 없어서 그대로 두었어요."
elif [[ "$KEY" != sk-ant-* ]]; then
  echo "⚠ Anthropic API 키 형식(sk-ant-...)이 아니에요. 다시 확인해 주세요. 저장하지 않았어요."
else
  umask 077
  printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" > .env
  chmod 600 .env
  echo "✅ 저장했어요. 앱에서 ✨ 버튼을 다시 눌러 보세요. (서버를 다시 켤 필요 없어요)"
fi
unset KEY
read -n 1 -s -r -p "아무 키나 누르면 창이 닫혀요."
echo
