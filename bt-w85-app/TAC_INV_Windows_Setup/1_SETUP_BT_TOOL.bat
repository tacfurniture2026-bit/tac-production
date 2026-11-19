@echo off
setlocal
title TAC 棚卸業務アプリ (BT-W85 / BT開発・運用ツール) 自動セットアップ

echo ============================================================================
echo   TAC 生産管理システム連携 - KEYENCE BT開発・運用ツール 自動セットアップ
echo ============================================================================
echo.

set "SRC_DIR=%~dp0TAC_INV"
set "MASTER_SRC=%~dp0MasterData"

REM Windows の ドキュメント フォルダパスを自動取得 (OneDrive環境にも対応)
for /f "tokens=2*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v "Personal" 2^>nul') do set "DOC_DIR=%%B"
if "%DOC_DIR%"=="" set "DOC_DIR=%USERPROFILE%\Documents"

set "KEYENCE_PROJ_ROOT=%DOC_DIR%\KEYENCE\BT Application Design Tool\Projects"
set "TARGET_DIR=%KEYENCE_PROJ_ROOT%\TAC_INV"

echo [1/4] KEYENCE プロジェクトフォルダを作成しています...
echo       配置先: "%TARGET_DIR%"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo.
echo [2/4] 最新棚卸アプリ (TAC_INV 一式) を自動配置しています...
xcopy /Y /Q "%SRC_DIR%\*.*" "%TARGET_DIR%\" >nul

echo.
echo [3/4] 最新マスタ (MasterFile_1.csv / 先月在庫入り) を自動配置しています...
REM デスクトップにデータ送受信用フォルダを作成しマスタもコピー
for /f "tokens=2*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v "Desktop" 2^>nul') do set "DESKTOP_DIR=%%B"
if "%DESKTOP_DIR%"=="" set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "WORK_DIR=%DESKTOP_DIR%\TAC_HT棚卸データ"
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"
if exist "%MASTER_SRC%\*.*" xcopy /Y /Q "%MASTER_SRC%\*.*" "%WORK_DIR%\" >nul
if exist "%MASTER_SRC%\MasterFile_1.csv" copy /Y "%MASTER_SRC%\MasterFile_1.csv" "%TARGET_DIR%\MasterFile_1.csv" >nul

echo       -^> アプリ配置先: "%TARGET_DIR%"
echo       -^> マスタ配置先: "%WORK_DIR%\MasterFile_1.csv"
echo.
echo [4/4] KEYENCE「BT開発・運用ツール (TAC_INV.btsln)」を自動起動しています...
echo.
echo ============================================================================
echo  【ここから先だけ手動操作が必要です（KEYENCE専用ソフトのボタン3つ）】
echo   1. BT-W85（ハンディ本体）を通信ユニット（BT-H10W）に置きます。
echo   2. 起動した「BT開発・運用ツール」の画面上部にある
echo      [HTへ転送] をクリックして、最新アプリをハンディに書き込みます。
echo   3. 続いて画面上部の [PCアプリケーション起動] をクリックします。
echo   4. PCアプリ画面の [端末マスターファイル作成] をクリックし、
echo      送信フォルダに "%WORK_DIR%\MasterFile_1.csv" を指定して作成します。
echo      ※完了後、ハンディ側で通信（マスタ受信）を実行すると
echo        品名と先月在庫が画面に表示されるようになります。
echo ============================================================================
echo.

if exist "%TARGET_DIR%\TAC_INV.btsln" (
    start "" "%TARGET_DIR%\TAC_INV.btsln"
) else (
    echo [エラー] "%TARGET_DIR%\TAC_INV.btsln" が見つかりません。
)

pause
