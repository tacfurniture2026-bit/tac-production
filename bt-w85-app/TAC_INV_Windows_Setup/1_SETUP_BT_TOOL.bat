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

echo [1/3] KEYENCE プロジェクトフォルダを作成しています...
echo       配置先: "%TARGET_DIR%"
if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"

echo.
echo [2/3] 完成済み棚卸アプリ (TAC_INV 7ファイル) をコピーしています...
xcopy /Y /Q "%SRC_DIR%\*.*" "%TARGET_DIR%\" >nul

REM デスクトップにデータ送受信用フォルダを作成しマスタもコピー
for /f "tokens=2*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders" /v "Desktop" 2^>nul') do set "DESKTOP_DIR=%%B"
if "%DESKTOP_DIR%"=="" set "DESKTOP_DIR=%USERPROFILE%\Desktop"
set "WORK_DIR=%DESKTOP_DIR%\TAC_HT棚卸データ"
if not exist "%WORK_DIR%" mkdir "%WORK_DIR%"
if exist "%MASTER_SRC%\*.*" xcopy /Y /Q "%MASTER_SRC%\*.*" "%WORK_DIR%\" >nul

echo       -^> プロジェクトおよびマスタデータの配置が完了しました！
echo.
echo [3/3] KEYENCE「BT開発・運用ツール (TAC_INV.btsln)」を起動しています...
echo.
echo ============================================================================
echo  【重要：ツールが起動した後の操作（これだけで完了します）】
echo   1. BT-W85（ハンディ本体）を通信ユニット（BT-H10W）に置くかUSB接続します。
echo   2. 起動した「BT開発・運用ツール」の画面上部にある
echo      [HTへ転送]（または [端末へ送信] / ハンディのアイコン）をクリックします。
echo   3. 続いて画面上部の [PCアプリケーション起動]（パソコンのアイコン）を
echo      クリックすると、PC側のデータ受信画面が立ち上がります。
echo ============================================================================
echo.

if exist "%TARGET_DIR%\TAC_INV.btsln" (
    start "" "%TARGET_DIR%\TAC_INV.btsln"
) else (
    echo [エラー] "%TARGET_DIR%\TAC_INV.btsln" が見つかりません。
)

pause
