# -*- mode: python ; coding: utf-8 -*-
# 메모 플래너 단독 실행 프로그램 설계도 (PyInstaller)
#   빌드:  .venv/bin/python -m PyInstaller --noconfirm --clean memomate.spec
#   결과:  Mac     -> dist/MemoMate.app
#          Windows -> dist/MemoMate/MemoMate.exe  (폴더째로 배포: onedir 방식)
import os
import sys

from PyInstaller.utils.hooks import collect_data_files, collect_submodules

HERE = os.path.abspath(SPECPATH)  # 이 설계도 파일이 있는 폴더

# 화면 파일만 포함 (index.html, css, js). .env 등 다른 개인 파일은 넣지 않아요.
datas = [
    (os.path.join(HERE, "index.html"), "."),
    (os.path.join(HERE, "css"), "css"),
    (os.path.join(HERE, "js"), "js"),
]
datas += collect_data_files("anthropic")
hiddenimports = collect_submodules("anthropic")

a = Analysis(
    [os.path.join(HERE, "server.py")],
    pathex=[HERE],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,  # onedir: 실행 파일과 라이브러리를 폴더에 따로 둠
    name="MemoMate",
    debug=False,
    strip=False,
    upx=False,
    console=False,  # 검은 터미널 창 없이 실행 (로그는 사용자 폴더의 memomate.log)
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="MemoMate",
)

if sys.platform == "darwin":
    app = BUNDLE(
        coll,
        name="MemoMate.app",
        icon=None,
        bundle_identifier="kr.ac.kookmin.memomate",
        info_plist={
            "CFBundleName": "MemoMate",
            "CFBundleDisplayName": "메모 플래너",
            "CFBundleShortVersionString": "1.0.0",
            "NSHighResolutionCapable": True,
        },
    )
