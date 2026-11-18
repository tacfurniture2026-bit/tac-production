@echo off
setlocal
title TAC 棚卸スキャン受信データ (Record.csv) 自動回収ツール

echo ============================================================================
echo   BT-W85 から送信された棚卸データ (Record.csv) を探して回収します
echo ============================================================================
echo.

for /f "tokens=2*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v "Personal" 2^>nul') do set "DOC_DIR=%%B"
if "%DOC_DIR%"=="" set "DOC_DIR=%USERPROFILE%\Documents"

for /f "tokens=2*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v "Desktop" 2^>nul') do set "DESKTOP_DIR=%%B"
if "%DESKTOP_DIR%"=="" set "DESKTOP_DIR=%USERPROFILE%\Desktop"

set "WORK_DIR=%DESKTOP_DIR%\TAC_HT棚卸データ"
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"

set "FOUND_CSV="
for /f "delims=" %%F in ('dir /s /b /o-d "%DOC_DIR%\KEYENCE\*Record*.csv" 2^>nul') do (
    if not defined FOUND_CSV set "FOUND_CSV=%%F"
)

if defined FOUND_CSV (
    echo [発見] 最新の受信データが見つかりました:
    echo        "%FOUND_CSV%"
    copy /Y "%FOUND_CSV%" "%WORK_DIR%\Record.csv" >nul
    echo.
    echo -^> デスクトップの「TAC_HT棚卸データ」フォルダに Record.csv をコピーしました！
    echo    生産管理システムの「HTデータ取り込み」画面でこの Record.csv を選択してください。
    explorer "%WORK_DIR%"
) else (
    echo [お知らせ] KEYENCEフォルダ内にまだ Record.csv が見つかりませんでした。
    echo            1. BT開発・運用ツールで「PCアプリケーション」を起動しているか確認
    echo            2. ハンディ(BT-W85)を通信ユニットに置いて [F2:送信] を押してください。
    echo.
    echo デスクトップの「TAC_HT棚卸データ」フォルダを開きます（サンプルCSV同梱）...
    explorer "%WORK_DIR%"
)

echo.
pause
