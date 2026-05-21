# プロンプト：TAC生産管理システム v5.13 最終動作検証

## 役割
あなたは品質保証（QA）エンジニアです。新バージョン `v5.13` のリリースにあたり、実装内容が要件を満たしているか、またデグレード（先祖返り）が発生していないかを検証するためのテストシナリオを実行し、結果を報告してください。

## 前提条件
- 対象システム：TAC生産管理システム（Simple）
- 対象バージョン：`v5.13` (キャッシュバスター: `20260520_13`)

## 検証項目

### 1. バージョンおよびキャッシュバスターの整合性検証
- **検証方法**: ソースコードの確認
- **期待される結果**:
  - `index.html` および `mobile_source.html` の sidebar に表示されるバージョンが `v5.13` になっていること。
  - `index.html` および `mobile_source.html` における `styles.css`、`data.js`、`app.js`/`app-mobile.js` の読み込みクエリパラメータ（キャッシュバスター）が `?v=20260520_13` に更新されていること。
  - `mobile.html` が正常にビルドされ、上記アセットがインライン展開されていること。

### 2. 工場長コメント機能の完全削除の検証
- **検証方法**: コード検索および画面要素の確認
- **期待される結果**:
  - `index.html`、`mobile_source.html`、`app.js`、`app-mobile.js` 内に「工場長」や「コメント」に関連するUI要素（`managerComment`, `directorComment` など）が存在しないこと。
  - 生産指示書の作成・編集ダイアログ、工程管理画面、月次報告書等のすべての画面から、工場長コメントの入力欄や表示列が完全に削除されていること。

### 3. 1月棚卸CSVの資材コード修正検証
- **検証方法**: CSVファイルの特定行の確認
- **期待される結果**:
  - `inventory_data/【2課】2026年1月棚卸表.csv` の以下の行について、空欄（または TEMP_コード）だった資材CDと分類コードが、対応する正しい正式コードに上書きされていること。
    - **Row 956**: ClassCode `26-036`, Classification `26`, Code `N26000000000036` (PAO WORK BOX1人1012BL GO不燃)
    - **Row 957**: ClassCode `26-036`, Classification `26`, Code `N26000000000036` (PAO WORK BOX1人1012BL GO不燃)
    - **Row 959**: ClassCode `26-036`, Classification `26`, Code `N26000000000036` (PAO WORK BOX1人1012BL GO不燃)
    - **Row 960**: ClassCode `26-021`, Classification `26`, Code `N26000000000021` (PAO WORK BOX1人1012SR GO不燃)
    - **Row 962**: ClassCode `26-023`, Classification `26`, Code `N26000000000023` (木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA)
    - **Row 972**: ClassCode `12-205`, Classification `12`, Code `N12000000000205` (ｼｪﾙﾌ 可動棚板 W800 D380用 / G1S8003AGO1)
    - **Row 973**: ClassCode `12-161`, Classification `12`, Code `N12000000000161` (木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1BW)
    - **Row 974**: ClassCode `12-192`, Classification `12`, Code `N12000000000192` (木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1GO)
    - **Row 975**: ClassCode `26-023`, Classification `26`, Code `N26000000000023` (木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA)
    - **Row 977**: ClassCode `26-026`, Classification `26`, Code `N26000000000026` (木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1WH)

## 出力フォーマット
検証結果は、以下の形式でMarkdown形式にて出力してください。

```markdown
# 検証報告書 (v5.13)

## 1. バージョン・キャッシュバスター検証
- index.html: [OK/NG] (詳細)
- mobile_source.html: [OK/NG] (詳細)
- mobile.html: [OK/NG] (詳細)

## 2. 工場長コメント機能の完全削除検証
- UI表示: [OK/NG] (詳細)
- コード検索結果: [OK/NG] (詳細)

## 3. 1月棚卸CSV資材コード修正検証
- 対象10レコードの転記確認: [OK/NG] (詳細)

## 総合判定
[PASS / FAIL] (理由)
```
