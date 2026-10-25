const fs = require('fs');

console.log('--- Adding KEYENCE BT-W85 / BT-H10W Batch Import Feature (v6.69.0) ---');

// 1. Update index.html and mobile_source.html
function patchHtml(filename) {
    let html = fs.readFileSync(filename, 'utf8');

    // Add encoding-japanese CDN if not present
    if (!html.includes('encoding-japanese')) {
        const xlsxScript = '<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>';
        if (html.includes(xlsxScript)) {
            html = html.replace(
                xlsxScript,
                xlsxScript + '\n    <script src="https://cdnjs.cloudflare.com/ajax/libs/encoding-japanese/2.0.0/encoding.min.js"></script>'
            );
        }
    }

    // a) Add HT banner card in #page-inv-scan
    const invScanTarget = `<div id="page-inv-scan" class="page">`;
    const htBannerHtml = `
                <!-- KEYENCE BT-W85 ハンディターミナル バッチ取込パネル -->
                <div class="card" id="ht-batch-banner-card" style="margin-bottom: 1.5rem; border: 2px solid #0284c7; background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);">
                    <div class="card-body" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding: 1.25rem;">
                        <div style="flex: 1; min-width: 260px;">
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
                                <span style="background: #0284c7; color: white; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">KEYENCE BT-W85 / BT-H10W 対応</span>
                                <h3 style="margin: 0; color: #0369a1; font-size: 1.15rem;">📠 ハンディターミナル (HT) 棚卸データ一括取込</h3>
                            </div>
                            <p style="margin: 0; font-size: 0.875rem; color: #475569; line-height: 1.5;">
                                スキャナ <strong>BT-W85</strong> で読み取った棚卸CSVデータ（<code>INV_LOG.CSV</code> 等）をバッチで一括取り込みし、現在の商品マスタと自動照合して仮登録へ反映します。（※下のスマホQRスキャンや手入力もそのまま併用可能です）
                            </p>
                        </div>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                            <button type="button" class="btn btn-primary" onclick="openHtImportModal('import')" style="background-color: #0284c7; border-color: #0284c7; font-weight: bold; padding: 12px 20px; font-size: 1rem; box-shadow: 0 2px 6px rgba(2,132,199,0.3);">
                                📥 HTデータ取り込み
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="openHtImportModal('master')" style="padding: 10px 14px; font-size: 0.875rem;">
                                📤 HT用マスタ・アプリ出力
                            </button>
                            <button type="button" class="btn btn-secondary" onclick="openHtImportModal('guide')" style="padding: 10px 14px; font-size: 0.875rem;">
                                📖 HT開発・取込ガイド
                            </button>
                        </div>
                    </div>
                </div>`;

    if (html.includes(invScanTarget) && !html.includes('id="ht-batch-banner-card"')) {
        const scanStartIdx = html.indexOf(invScanTarget);
        const qrLayoutIdx = html.indexOf('<div class="qr-layout">', scanStartIdx);
        if (qrLayoutIdx !== -1) {
            html = html.substring(0, qrLayoutIdx) + htBannerHtml + '\n                ' + html.substring(qrLayoutIdx);
        }
    }

    // b) Add HT Import button in #page-inv-check header
    const reloadMasterBtn = `<button class="btn btn-secondary" onclick="forceReloadMaster()">🔄 マスタ再読込</button>`;
    const htCheckBtn = `<button class="btn btn-primary" onclick="openHtImportModal('import')" style="background-color: #0284c7; border-color: #0284c7; font-weight: bold;">📥 HTデータ取り込み</button>\n                            ` + reloadMasterBtn;
    if (html.includes(reloadMasterBtn) && !html.includes('openHtImportModal(\'import\')" style="background-color: #0284c7; border-color: #0284c7; font-weight: bold;">📥 HTデータ取り込み')) {
        html = html.replace(reloadMasterBtn, htCheckBtn);
    }

    // c) Add HT Master CSV export button in #page-inv-products header
    const exportCsvBtn = `<button class="btn btn-secondary" id="export-inv-csv-btn">📤 CSV出力</button>`;
    const htMasterBtn = exportCsvBtn + `\n                            <button class="btn btn-secondary" onclick="exportHtMasterCsv()" style="background-color: #0284c7; color: white; border-color: #0284c7;">📠 HT用マスタ出力</button>`;
    if (html.includes(exportCsvBtn) && !html.includes('exportHtMasterCsv()')) {
        html = html.replace(exportCsvBtn, htMasterBtn);
    }

    // Bump version v6.68.0 -> v6.69.0
    html = html.replace(/v6\.68\.0/g, 'v6.69.0');

    fs.writeFileSync(filename, html);
    console.log(`Patched ${filename}`);
}

patchHtml('index.html');
patchHtml('mobile_source.html');

// Bump sw.js
let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw.replace(/v6\.68\.0/g, 'v6.69.0');
fs.writeFileSync('sw.js', sw);
console.log('Patched sw.js');

// 2. Append HT Import & BT-W85 / BT-H10W App Generator functions to app.js and app-mobile.js
const htFeatureJs = `

// ============================================================================
// 📠 KEYENCE BT-W85 / BT-H10W ハンディターミナル (HT) バッチ棚卸連携システム
// ============================================================================

window._parsedHtBatchItems = [];

window.openHtImportModal = function(initialTab = 'import') {
  const defaultMonth = (typeof getInventoryNextTargetMonth === 'function')
    ? getInventoryNextTargetMonth()
    : (($('#inv-check-month') && $('#inv-check-month').value) || ($('#inv-scan-month') && $('#inv-scan-month').value) || new Date().toISOString().substring(0, 7));

  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];

  const body = \`
    <div style="padding: 0.5rem;">
      <!-- タブナビゲーション -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 1.25rem; flex-wrap: wrap;">
        <button type="button" id="ht-tab-btn-import" class="btn" onclick="switchHtModalTab('import')" style="border-radius: 6px 6px 0 0; font-weight: bold; background: #0284c7; color: white; padding: 10px 16px;">
          📥 1. HTデータ取り込み (CSV)
        </button>
        <button type="button" id="ht-tab-btn-master" class="btn" onclick="switchHtModalTab('master')" style="border-radius: 6px 6px 0 0; font-weight: bold; background: #f1f5f9; color: #475569; padding: 10px 16px;">
          📤 2. BT-W85用マスタ & ソフト出力
        </button>
        <button type="button" id="ht-tab-btn-guide" class="btn" onclick="switchHtModalTab('guide')" style="border-radius: 6px 6px 0 0; font-weight: bold; background: #f1f5f9; color: #475569; padding: 10px 16px;">
          📖 3. BT-H10W 開発・取込手順書
        </button>
      </div>

      <!-- タブ1: HTデータ取り込み -->
      <div id="ht-tab-content-import" style="display: block;">
        <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 12px 16px; border-radius: 6px; margin-bottom: 1rem; font-size: 0.875rem; color: #0c4a6e;">
          <strong>💡 BT-W85 からのCSV取り込み：</strong><br>
          ハンディターミナル（BT-W85）でスキャンして出力されたCSVファイル（<code>INV_LOG.CSV</code> 等）を選択してください。<br>
          現在の商品マスタ（登録数: <strong>\${products.length}件</strong>）と自動で資材ID照合を行い、棚卸の「仮登録データ」へ一括反映します。
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; background: var(--color-bg-secondary); padding: 1rem; border-radius: 8px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-weight: bold; font-size: 0.85rem;">📅 棚卸対象年月</label>
            <input type="month" id="ht-import-month" class="form-input" value="\${defaultMonth}">
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-weight: bold; font-size: 0.85rem;">🔢 同一資材IDが複数行ある場合</label>
            <select id="ht-duplicate-mode" class="form-input" onchange="parseHtCsvFile()">
              <option value="sum" selected>➕ 数量を合算（加算）する【推奨】</option>
              <option value="overwrite">🔄 最後のスキャン行の数量で上書き</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label style="font-weight: bold; font-size: 0.85rem;">🗂 既存の仮登録データとの統合</label>
            <select id="ht-merge-mode" class="form-input">
              <option value="merge_overwrite" selected>🔄 既存データを残しHT読取分を更新</option>
              <option value="merge_add">➕ 既存の仮登録数量にさらに加算する</option>
              <option value="replace_all">🧹 当月の仮登録を一旦全消去して新規反映</option>
            </select>
          </div>
        </div>

        <div style="border: 2px dashed #0284c7; border-radius: 8px; padding: 1.25rem; text-align: center; background: #f8fafc; margin-bottom: 1rem;">
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📂 CSV / TXT ファイルを選択</div>
          <p style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.75rem;">
            対応形式: <code>[資材ID, 数量]</code> または <code>[日付, 時刻, 端末ID, 資材ID, (品名), 数量]</code> （Shift-JIS / UTF-8 自動判別）
          </p>
          <input type="file" id="ht-csv-file-input" accept=".csv,.txt,.log,.dat" class="form-input" style="max-width: 450px; margin: 0 auto;" onchange="parseHtCsvFile()">
          <div style="margin-top: 0.75rem;">
            <button type="button" class="btn btn-sm btn-secondary" onclick="downloadSampleHtCsv()" style="font-size: 0.78rem;">
              🧪 動作確認用のサンプルHTデータ(CSV)をダウンロードして試す
            </button>
          </div>
        </div>

        <div style="margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; cursor: pointer;">
            <input type="checkbox" id="ht-auto-register-unknown" checked>
            マスタ未登録の資材IDが含まれる場合、仮マスタとして自動追加して取り込む
          </label>
          <div id="ht-preview-summary" style="font-size: 0.875rem; font-weight: bold; color: #0369a1;"></div>
        </div>

        <!-- プレビューテーブル -->
        <div id="ht-preview-container" style="max-height: 280px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 8px; display: none;">
          <table class="table" style="font-size: 0.85rem; margin: 0;">
            <thead style="position: sticky; top: 0; background: var(--color-bg-tertiary); z-index: 2;">
              <tr>
                <th>資材ID</th>
                <th>分類</th>
                <th>品名（マスタ照合）</th>
                <th>単価</th>
                <th style="width: 110px; text-align: center;">取込数量</th>
                <th>読取回数</th>
                <th>照合状態</th>
              </tr>
            </thead>
            <tbody id="ht-preview-tbody"></tbody>
          </table>
        </div>
      </div>

      <!-- タブ2: BT-W85用マスタ & ソフト出力 -->
      <div id="ht-tab-content-master" style="display: none;">
        <div style="display: grid; gap: 1rem;">
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 1.25rem; background: #fff;">
            <h4 style="margin: 0 0 0.5rem 0; color: #0369a1;">① BT-W85用 商品マスタファイル (MASTER.CSV) 出力</h4>
            <p style="font-size: 0.875rem; color: #475569; margin-bottom: 1rem; line-height: 1.5;">
              現在この生産管理システムに登録されている商品マスタ（<strong>\${products.length}件</strong>）を、ハンディターミナル <strong>BT-W85</strong> 用の形式（Shift-JIS / <code>資材ID,品名,単価</code>）で出力します。<br>
              ※BT-W85に転送しておくと、スキャン時にハンディの画面に「品名」と「単価」が表示されます。（マスタ転送なしでもQRコードの資材IDだけでスキャン＆取込は可能です）
            </p>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary" onclick="exportHtMasterCsv()" style="background: #0284c7; border-color: #0284c7;">
                📤 MASTER.CSV をダウンロード (BT-W85用 Shift-JIS)
              </button>
              <button type="button" class="btn btn-secondary" onclick="downloadBtH10wMasterIni()">
                ⚙️ HTMasterFileInfo.ini をダウンロード
              </button>
            </div>
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 1.25rem; background: #fff;">
            <h4 style="margin: 0 0 0.5rem 0; color: #0f766e;">② BT-H10W 用 棚卸専用アプリケーション (TAC_TANAOROSHI.scp)</h4>
            <p style="font-size: 0.875rem; color: #475569; margin-bottom: 1rem; line-height: 1.5;">
              KEYENCE <strong>BT-H10W</strong> 用の棚卸スキャン専用プログラムソースコードです。<br>
              メニューは<strong>「棚卸スキャン」</strong>に特化しており、QRコード読取 ➔ 実棚数量入力 ➔ <code>INV_LOG.CSV</code> 出力を行います。
            </p>
            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
              <button type="button" class="btn btn-primary" onclick="downloadBtH10wAppSource()" style="background: #0f766e; border-color: #0f766e;">
                💻 BT-H10W スクリプト (TAC_TANAOROSHI.scp) をダウンロード
              </button>
              <button type="button" class="btn btn-secondary" onclick="downloadSampleHtCsv()">
                🧪 テスト用HT出力サンプル (INV_LOG.CSV) をダウンロード
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- タブ3: 開発・取込手順書 -->
      <div id="ht-tab-content-guide" style="display: none; max-height: 460px; overflow-y: auto; padding: 0.75rem; background: #f8fafc; border-radius: 8px; border: 1px solid #cbd5e1; font-size: 0.875rem; line-height: 1.65; color: #1e293b;">
        <h4 style="color: #0369a1; margin-top: 0; border-bottom: 2px solid #0284c7; padding-bottom: 6px;">📘 ステップ1：BT-H10W（BT-Navigator）でのアプリ作成手順（5分で完了）</h4>
        <ol style="padding-left: 1.25rem; margin-bottom: 1rem;">
          <li>PCで <strong>KEYENCE BT-H10W（BT-Navigator / アプリケーション簡単作成ツール）</strong> を起動し、対象機種に <strong>「BT-W85（またはBT-W80シリーズ）」</strong> を選択して新規作成します。</li>
          <li><strong>メニュー設定：</strong> 不要な業務メニューのチェックを外し、<strong>「棚卸（またはログ収集）」の1業務のみ</strong>にします（起動後すぐに棚卸スキャンが始まる設定も可能です）。</li>
          <li><strong>マスタ設定（任意）：</strong> 上の「2. BT-W85用マスタ出力」タブからダウンロードした <code>MASTER.CSV</code>（1列目:資材ID、2列目:品名、3列目:単価）を参照するように設定します。<strong>「マスタにないコードも入力許可する（照合エラーで止めない）」</strong>にします。</li>
          <li><strong>入力項目設定：</strong>
            <ul>
              <li><strong>項目1（資材ID）</strong>：読取種別＝「QRコード / バーコードすべて許可」、桁数制限＝なし。</li>
              <li><strong>項目2（実棚数量）</strong>：入力種別＝「数値（テンキー入力）」、初期値＝「1（または空欄）」、最大桁数＝6桁。</li>
            </ul>
          </li>
          <li><strong>出力ログ設定（CSV形式）：</strong>
            <ul>
              <li>ファイル名：<code>INV_LOG.CSV</code>（または <code>TANAOROSHI.CSV</code>）</li>
              <li>区切り文字：カンマ（<code>,</code>）</li>
              <li>出力項目：<code>日付, 時刻, 端末番号, 資材ID(項目1), 数量(項目2)</code>（※<code>資材ID, 数量</code> の2列のみでも自動認識します）</li>
            </ul>
          </li>
          <li><strong>実機へ転送：</strong> BT-W85をUSB通信ユニット（クレードル）に置き、BT-W85側で「システムメニュー」➔「通信待受」にして、PCのBT-H10Wから<strong>「アプリ送信（およびマスタ送信）」</strong>をクリックします。</li>
        </ol>

        <h4 style="color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 6px;">📗 ステップ2：現場での BT-W85 棚卸スキャン手順</h4>
        <ol style="padding-left: 1.25rem; margin-bottom: 1rem;">
          <li>BT-W85の電源を入れ、<strong>「棚卸スキャン」</strong>を開きます。</li>
          <li>棚や資材に貼られている<strong>「品名QRコード」</strong>（当システムの商品マスタや棚卸確認画面から印刷したもの）をトリガーボタンでスキャンします。</li>
          <li>画面に品名が表示されます。テンキーで<strong>「実棚数量」</strong>を入力し、<strong>[ENT]キー</strong>を押します。</li>
          <li>「ピッ」と音が鳴り、端末内のCSVに1行保存され、すぐに次のQRスキャン待機に戻ります。これを繰り返します。</li>
        </ol>

        <h4 style="color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 6px;">📙 ステップ3：PCへのCSV回収と、生産管理システムへの取り込み手順</h4>
        <ol style="padding-left: 1.25rem; margin-bottom: 0.5rem;">
          <li>スキャンが終わったら、BT-W85をPC接続されたクレードル（USB通信ユニット）に置きます。</li>
          <li>PCの「データ転送ソフト（BT-Navigator通信ツール）」で<strong>「ログ受信（データ受信）」</strong>を実行すると、PCの受信フォルダに <code>INV_LOG.CSV</code> が保存されます。</li>
          <li>この生産管理システムの「棚卸スキャン」または「棚卸スキャン確認」画面にある <strong>「📥 HTデータ取り込み」</strong> ボタンを押します。</li>
          <li>保存された <code>INV_LOG.CSV</code> を選択すると、自動でマスタ照合＆数量集計されたプレビューが表示されます。</li>
          <li>下の <strong>「🚀 棚卸仮登録へ一括反映する」</strong> ボタンを押せば取り込み完了です！</li>
          <li>そのまま「☑ 棚卸スキャン確認」画面で未スキャン漏れがないか確認し、<strong>「✓ 棚卸確定 (締め処理)」</strong>を押して月次在庫を確定させます。</li>
        </ol>
      </div>
    </div>
  \`;

  const footer = \`
    <button type="button" class="btn btn-secondary" onclick="hideModal()">閉じる</button>
    <button type="button" class="btn btn-primary" id="ht-execute-import-btn" onclick="executeHtBatchImport()" style="background: #0284c7; border-color: #0284c7; font-weight: bold;" disabled>
      🚀 棚卸仮登録へ一括反映する
    </button>
  \`;

  showModal('📠 ハンディターミナル (BT-W85) 棚卸バッチ取込 & 連携', body, footer);

  const modalEl = $('#modal');
  if (modalEl) {
    modalEl.style.maxWidth = '920px';
    modalEl.style.width = '95%';
  }

  window._parsedHtBatchItems = [];
  if (initialTab && initialTab !== 'import') {
    switchHtModalTab(initialTab);
  }
};

window.switchHtModalTab = function(tabName) {
  const tabs = ['import', 'master', 'guide'];
  tabs.forEach(t => {
    const content = document.getElementById('ht-tab-content-' + t);
    const btn = document.getElementById('ht-tab-btn-' + t);
    if (content) content.style.display = (t === tabName) ? 'block' : 'none';
    if (btn) {
      if (t === tabName) {
        btn.style.background = '#0284c7';
        btn.style.color = 'white';
      } else {
        btn.style.background = '#f1f5f9';
        btn.style.color = '#475569';
      }
    }
  });
  const execBtn = document.getElementById('ht-execute-import-btn');
  if (execBtn) {
    execBtn.style.display = (tabName === 'import') ? 'inline-block' : 'none';
  }
};

// スマートCSV解析: BT-W85のあらゆるCSV列構成を自動判別して集計
window.parseHtCsvFile = function() {
  const fileInput = document.getElementById('ht-csv-file-input');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) return;

  const file = fileInput.files[0];
  const dupMode = (document.getElementById('ht-duplicate-mode') || {}).value || 'sum';
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];

  // 高速照合マップ作成 (id と identCode の両方に対応)
  const prodMap = {};
  products.forEach(p => {
    if (p && p.id) {
      prodMap[String(p.id).trim().toUpperCase()] = p;
    }
    if (p && p.identCode) {
      prodMap[String(p.identCode).trim().toUpperCase()] = p;
    }
  });

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const uint8 = new Uint8Array(evt.target.result);
      const text = (typeof decodeCsvBuffer === 'function')
        ? decodeCsvBuffer(uint8)
        : new TextDecoder('utf-8').decode(uint8);

      const rows = (typeof parseCsv === 'function')
        ? parseCsv(text)
        : text.split(/\\r?\\n/).map(line => line.split(',').map(c => c.trim().replace(/^"|"$/g, '')));

      const aggregated = {}; // productId -> { productId, rawCode, name, category, price, quantity, scanCount, isMatched, worker }

      rows.forEach((row, idx) => {
        if (!row || row.length === 0) return;
        const cleanCols = row.map(c => String(c || '').trim().replace(/^"|"$/g, ''));
        if (cleanCols.every(c => c === '')) return;

        // 1行目がヘッダー行かどうかを判定
        const joinedUpper = cleanCols.join(',').toUpperCase();
        if (idx === 0 && (
          joinedUpper.includes('資材ID') ||
          joinedUpper.includes('商品コード') ||
          joinedUpper.includes('PRODUCT') ||
          joinedUpper.includes('BARCODE') ||
          joinedUpper.includes('数量') ||
          joinedUpper.includes('QTY')
        )) {
          return; // ヘッダー行スキップ
        }

        let detectedId = '';
        let detectedQty = null;
        let detectedWorker = 'BT-W85';

        // 1列のみの場合（QR連続スキャンで1スキャン=1個カウントのケース）
        if (cleanCols.length === 1) {
          detectedId = cleanCols[0];
          detectedQty = 1;
        } else if (cleanCols.length === 2) {
          // 2列: [資材ID, 数量]
          detectedId = cleanCols[0];
          detectedQty = parseFloat(cleanCols[1].replace(/[^0-9.-]/g, ''));
        } else {
          // 3列以上（例: [日付, 時刻, 端末ID, 資材ID, (品名), 数量] または [資材ID, 品名, 数量]）
          // まず末尾の数値列を数量として取得
          for (let c = cleanCols.length - 1; c >= 1; c--) {
            const val = cleanCols[c];
            if (/^-?\\d+(\\.\\d+)?$/.test(val)) {
              detectedQty = parseFloat(val);
              break;
            }
          }

          // 次にマスタに一致する列があるか探す
          for (let c = 0; c < cleanCols.length - 1; c++) {
            const candidate = cleanCols[c].toUpperCase();
            if (prodMap[candidate]) {
              detectedId = prodMap[candidate].id;
              break;
            }
          }

          // マスタにないコードの場合、日付・時刻・端末名を除外して資材ID列を特定
          if (!detectedId) {
            const isDateCol = (s) => /^\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}/.test(s) || /^\\d{8}$/.test(s);
            const isTimeCol = (s) => /^\\d{1,2}:\\d{2}(:\\d{2})?$/.test(s);
            const isTermCol = (s) => /^(BTW|BT-|HT|TERM|USER|WORKER|ADMIN)/i.test(s);

            for (let c = 0; c < cleanCols.length - 1; c++) {
              const s = cleanCols[c];
              if (!s) continue;
              if (isDateCol(s) || isTimeCol(s)) continue;
              if (isTermCol(s)) {
                detectedWorker = s;
                continue;
              }
              detectedId = s;
              break;
            }
          }
        }

        if (!detectedId) return;
        if (detectedQty === null || isNaN(detectedQty)) detectedQty = 1;

        // マスタ照合
        const matchedProd = prodMap[detectedId.toUpperCase()];
        const finalId = matchedProd ? matchedProd.id : detectedId;

        if (!aggregated[finalId]) {
          aggregated[finalId] = {
            productId: finalId,
            name: matchedProd ? matchedProd.name : \`未登録資材 (\${finalId})\`,
            category: matchedProd ? (matchedProd.category || '99') : '99',
            price: matchedProd ? (parseFloat(matchedProd.price) || 0) : 0,
            quantity: detectedQty,
            scanCount: 1,
            isMatched: !!matchedProd,
            worker: detectedWorker
          };
        } else {
          aggregated[finalId].scanCount += 1;
          if (dupMode === 'sum') {
            aggregated[finalId].quantity += detectedQty;
          } else {
            aggregated[finalId].quantity = detectedQty;
          }
        }
      });

      const items = Object.values(aggregated);
      window._parsedHtBatchItems = items;

      const container = document.getElementById('ht-preview-container');
      const tbody = document.getElementById('ht-preview-tbody');
      const summaryEl = document.getElementById('ht-preview-summary');
      const execBtn = document.getElementById('ht-execute-import-btn');

      if (items.length === 0) {
        if (container) container.style.display = 'none';
        if (summaryEl) summaryEl.innerHTML = '<span style="color:#dc2626;">⚠️ 有効な棚卸データが見つかりませんでした</span>';
        if (execBtn) execBtn.disabled = true;
        return;
      }

      const matchedCount = items.filter(i => i.isMatched).length;
      const unknownCount = items.length - matchedCount;
      const totalQty = items.reduce((acc, i) => acc + i.quantity, 0);

      if (summaryEl) {
        summaryEl.innerHTML = \`読取資材: <strong>\${items.length}種類</strong> （マスタ一致: <span style="color:#16a34a;">\${matchedCount}件</span>\${unknownCount > 0 ? \` / 未登録: <span style="color:#d97706;">\${unknownCount}件</span>\` : ''} / 合計数量: <strong>\${totalQty.toLocaleString()}</strong>）\`;
      }

      if (tbody) {
        tbody.innerHTML = items.map((item, idx) => {
          const catLabel = (typeof INV_CATEGORIES !== 'undefined' && INV_CATEGORIES[item.category])
            ? INV_CATEGORIES[item.category]
            : item.category;
          const badge = item.isMatched
            ? '<span style="background:#dcfce7; color:#15803d; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;">✓ マスタ一致</span>'
            : '<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.75rem;">⚠️ マスタ未登録</span>';

          return \`
            <tr style="\${!item.isMatched ? 'background:#fffbeb;' : ''}">
              <td><strong>\${item.productId}</strong></td>
              <td>\${catLabel}</td>
              <td>\${item.name}</td>
              <td>¥\${item.price.toLocaleString()}</td>
              <td style="text-align: center;">
                <input type="number" class="form-input" value="\${item.quantity}" min="0"
                       style="width: 90px; padding: 4px; text-align: center; font-weight: bold;"
                       onchange="if(window._parsedHtBatchItems[\${idx}]) window._parsedHtBatchItems[\${idx}].quantity = parseFloat(this.value) || 0;">
              </td>
              <td style="text-align: center;">\${item.scanCount}回</td>
              <td>\${badge}</td>
            </tr>
          \`;
        }).join('');
      }

      if (container) container.style.display = 'block';
      if (execBtn) execBtn.disabled = false;
      toast(\`HTファイルから \${items.length} 件の資材データを解析しました\`, 'info');
    } catch (e) {
      console.error('HT CSV Parse Error:', e);
      toast('CSVの解析中にエラーが発生しました: ' + e.message, 'error');
    }
  };

  reader.readAsArrayBuffer(file);
};

// HTデータを棚卸仮登録(INV_PRODUCTS / INV_SCAN_TEMP / INV_LOGS)へ一括反映
window.executeHtBatchImport = function() {
  const items = window._parsedHtBatchItems || [];
  if (items.length === 0) {
    toast('取り込むデータがありません', 'error');
    return;
  }

  const targetMonth = (document.getElementById('ht-import-month') || {}).value || new Date().toISOString().substring(0, 7);
  const mergeMode = (document.getElementById('ht-merge-mode') || {}).value || 'merge_overwrite';
  const autoRegisterUnknown = document.getElementById('ht-auto-register-unknown')
    ? document.getElementById('ht-auto-register-unknown').checked
    : true;

  const [y, m] = targetMonth.split('-');
  const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0, 23, 59, 59).toISOString();
  const nowIso = new Date().toISOString();

  let products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  let tempScans = DB.get(DB.KEYS.INV_SCAN_TEMP) || [];
  let logs = DB.get(DB.KEYS.INV_LOGS) || [];

  // 当月既存クリアモードの場合
  if (mergeMode === 'replace_all') {
    products.forEach(p => {
      if (p.tempMonth === targetMonth) {
        delete p.tempQty;
        delete p.tempWorker;
        delete p.tempWorkerName;
        delete p.tempTimestamp;
        delete p.tempMonth;
        delete p.tempId;
      }
    });
    tempScans = tempScans.filter(s => s && s.month !== targetMonth);
    logs = logs.filter(l => !(l && l.type === 'count_temp' && (l.month === targetMonth || (l.timestamp && l.timestamp.startsWith(targetMonth)))));
  }

  let importedCount = 0;
  let newMasterCount = 0;
  let totalImportedQty = 0;

  items.forEach((item, idx) => {
    let prodIdx = products.findIndex(p => p && String(p.id).toUpperCase() === String(item.productId).toUpperCase());

    if (prodIdx === -1) {
      if (!autoRegisterUnknown) return; // スキップ
      const newProd = {
        id: item.productId,
        name: item.name,
        category: item.category || '99',
        price: item.price || 0,
        isFixed: false
      };
      products.push(newProd);
      prodIdx = products.length - 1;
      newMasterCount++;
    }

    const prod = products[prodIdx];
    const prevTempQty = (prod.tempMonth === targetMonth && typeof prod.tempQty === 'number') ? prod.tempQty : 0;
    const finalQty = (mergeMode === 'merge_add') ? (prevTempQty + item.quantity) : item.quantity;

    const scanId = Date.now() + '_ht_' + idx + '_' + prod.id;

    // 1. INV_PRODUCTS 側の仮登録プロパティ更新
    prod.tempQty = finalQty;
    prod.tempWorker = item.worker || 'BT-W85';
    prod.tempWorkerName = 'HT(BT-W85)';
    prod.tempTimestamp = lastDay;
    prod.tempMonth = targetMonth;
    prod.tempId = scanId;

    // 2. INV_SCAN_TEMP 側の更新
    const existingTempIdx = tempScans.findIndex(s => s && s.productId === prod.id && s.month === targetMonth);
    const scanRecord = {
      id: scanId,
      productId: prod.id,
      quantity: finalQty,
      worker: prod.tempWorker,
      workerName: prod.tempWorkerName,
      timestamp: lastDay,
      month: targetMonth,
      terminalId: 'BT-W85',
      type: 'count_temp'
    };
    if (existingTempIdx >= 0) {
      tempScans[existingTempIdx] = scanRecord;
    } else {
      tempScans.push(scanRecord);
    }

    // 3. INV_LOGS 側の更新 (本日の履歴・互換用)
    logs = logs.filter(l => !(l && l.type === 'count_temp' && l.productId === prod.id && (l.month === targetMonth || (l.timestamp && l.timestamp.startsWith(targetMonth)))));
    logs.push({
      ...scanRecord,
      timestamp: nowIso
    });

    importedCount++;
    totalImportedQty += finalQty;
  });

  // 保存
  DB.save(DB.KEYS.INV_PRODUCTS, JSON.parse(JSON.stringify(products)));
  DB.save(DB.KEYS.INV_SCAN_TEMP, JSON.parse(JSON.stringify(tempScans)));
  DB.save(DB.KEYS.INV_LOGS, JSON.parse(JSON.stringify(logs)));

  hideModal();

  // 対象月セレクタを同期
  if ($('#inv-check-month')) $('#inv-check-month').value = targetMonth;
  if ($('#inv-scan-month')) $('#inv-scan-month').value = targetMonth;

  if (typeof renderTodayInvLogs === 'function') renderTodayInvLogs();
  if (typeof renderInvCheckPage === 'function') renderInvCheckPage();
  if (typeof renderInvProductsTable === 'function') renderInvProductsTable();

  toast(\`✅ HTデータ \${importedCount}件（総数量: \${totalImportedQty.toLocaleString()}）を \${targetMonth} の仮登録に反映しました\`, 'success', 5000);

  if (confirm(\`✅ BT-W85 棚卸データの取り込みが完了しました！\\n\\n・反映件数: \${importedCount} 件\${newMasterCount > 0 ? \` (うち新規マスタ追加: \${newMasterCount}件)\` : ''}\\n・対象年月: \${targetMonth}\\n\\n続けて「☑ 棚卸スキャン確認」画面を開き、未スキャン漏れの確認や確定（締め）処理を行いますか？\`)) {
    if (typeof navigateTo === 'function') {
      navigateTo('inv-check');
    }
  }
};

// BT-W85用 商品マスタCSV (MASTER.CSV) を Shift-JIS で出力
window.exportHtMasterCsv = function() {
  const products = DB.get(DB.KEYS.INV_PRODUCTS) || [];
  if (products.length === 0) {
    toast('商品マスタが登録されていません', 'warning');
    return;
  }

  // BT-W85の画面表示に最適化したシンプル3列フォーマット: 資材ID,品名,単価
  const lines = products
    .filter(p => p && p.id && !String(p.id).startsWith('TEMP_'))
    .map(p => {
      const id = String(p.id || '').replace(/,/g, ' ').trim();
      const name = String(p.name || '').replace(/,/g, ' ').replace(/[\\r\\n]/g, ' ').trim();
      const price = parseInt(p.price, 10) || 0;
      return \`\${id},\${name},\${price}\`;
    });

  const csvString = lines.join('\\r\\n') + '\\r\\n';
  let blob;

  // Encoding.js が利用可能な場合は BT-W85 ネイティブの Shift-JIS に変換して文字化けを完全防止
  if (typeof Encoding !== 'undefined') {
    const unicodeArray = Encoding.stringToCode(csvString);
    const sjisArray = Encoding.convert(unicodeArray, { to: 'SJIS', from: 'UNICODE' });
    const uint8Array = new Uint8Array(sjisArray);
    blob = new Blob([uint8Array], { type: 'text/csv;charset=shift_jis;' });
  } else {
    blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'MASTER.CSV';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast('📤 BT-W85用 商品マスタ (MASTER.CSV) をダウンロードしました', 'success');
};

// BT-H10W マスタ転送設定ファイル (HTMasterFileInfo.ini) ダウンロード
window.downloadBtH10wMasterIni = function() {
  const iniContent = [
    '[MasterFile1]',
    'FileName=MASTER.CSV',
    'FieldCount=3',
    'KeyField1=1',
    'Field1Type=STRING',
    'Field1Length=32',
    'Field2Type=STRING',
    'Field2Length=64',
    'Field3Type=NUMERIC',
    'Field3Length=12',
    'Delimiter=COMMA',
    'Quote=NONE',
    ''
  ].join('\\r\\n');

  const blob = new Blob([iniContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'HTMasterFileInfo.ini';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast('⚙️ HTMasterFileInfo.ini をダウンロードしました', 'success');
};

// BT-H10W スクリプトソースコード (TAC_TANAOROSHI.scp) ダウンロード
window.downloadBtH10wAppSource = function() {
  const scpContent = \`' ====================================================================
' KEYENCE BT-W85 / BT-H10W 用 棚卸スキャン専用アプリケーション
' ファイル名: TAC_TANAOROSHI.scp
' 対象機種  : KEYENCE BT-W85
' メニュー  : 棚卸スキャンのみ（CSV出力: INV_LOG.CSV）
' ====================================================================

Include "BT_Lib.inc"

Dim g_strTerminalId As String
Dim g_strLogFile As String
Dim g_strMasterFile As String

Sub Main()
    Dim key As String
    g_strTerminalId = "BTW85"
    g_strLogFile = "INV_LOG.CSV"
    g_strMasterFile = "MASTER.CSV"

    While (1)
        LcdClear()
        LcdPrint(1, 1, "=== TAC 棚卸システム ===")
        LcdPrint(3, 1, "[1] 棚卸スキャン開始")
        LcdPrint(5, 1, "[2] PCへデータ送信")
        LcdPrint(7, 1, "[3] ログ件数確認/消去")
        LcdPrint(9, 1, "[1]またはENTで開始")

        key = KeyWait()
        If key = "1" Or key = "ENT" Or key = "TRG" Then
            Call DoInventoryScan()
        ElseIf key = "2" Then
            Call DoSendData()
        ElseIf key = "3" Then
            Call DoManageLog()
        End If
    Wend
End Sub

Sub DoInventoryScan()
    Dim strCode As String
    Dim strName As String
    Dim strPrice As String
    Dim strQty As String
    Dim strDate As String
    Dim strTime As String
    Dim strRecord As String
    Dim nCount As Integer

    While (1)
        LcdClear()
        nCount = GetLogCount(g_strLogFile)
        LcdPrint(1, 1, "【棚卸スキャン】件数:" & nCount)
        LcdPrint(2, 1, "------------------------")
        LcdPrint(3, 1, "資材QRを読取してください")
        LcdPrint(4, 1, "コード:")
        LcdPrint(9, 1, "[F1/CLR]:メニューへ戻る")

        strCode = ScanOrInput(4, 8)
        If strCode = "ESC" Or strCode = "F1" Or strCode = "" Then
            Exit Sub
        End If

        strName = "（マスタ照合）"
        strPrice = "-"
        Call LookupMaster(strCode, strName, strPrice)

        LcdPrint(5, 1, "品名:" & Left(strName, 18))
        LcdPrint(6, 1, "単価:¥" & strPrice)
        LcdPrint(7, 1, "実棚数量を入力[ENT]:")
        strQty = InputQuantity(8, 1, "1")

        If strQty <> "ESC" And strQty <> "" Then
            strDate = GetDateStr()
            strTime = GetTimeStr()
            strRecord = strDate & "," & strTime & "," & g_strTerminalId & "," & strCode & "," & strQty
            Call AppendCsvLine(g_strLogFile, strRecord)
            Buzzer(1, 100)
            Led(1, 200)
            LcdPrint(9, 1, "=> 登録OK! (" & strQty & "個)   ")
            Wait(300)
        End If
    Wend
End Sub
\`;

  const blob = new Blob([scpContent], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'TAC_TANAOROSHI.scp';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast('💻 BT-H10W用スクリプト (TAC_TANAOROSHI.scp) をダウンロードしました', 'success');
};

// 動作確認用のサンプルHT出力CSV (INV_LOG.CSV) を生成・ダウンロード
window.downloadSampleHtCsv = function() {
  const products = (DB.get(DB.KEYS.INV_PRODUCTS) || []).filter(p => p && p.id && !String(p.id).startsWith('TEMP_'));
  const sampleItems = products.slice(0, 5);
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');

  let lines = [];
  if (sampleItems.length > 0) {
    sampleItems.forEach((p, idx) => {
      const time = \`09:1\${idx}:00\`;
      const sampleQty = (idx + 1) * 10;
      lines.push(\`\${today},\${time},BTW85,\${p.id},\${sampleQty}\`);
    });
  } else {
    lines = [
      \`\${today},09:10:00,BTW85,N01-001,25\`,
      \`\${today},09:12:30,BTW85,N01-002,10\`,
      \`\${today},09:15:45,BTW85,N02-001,50\`
    ];
  }

  const csvContent = lines.join('\\r\\n') + '\\r\\n';
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'INV_LOG_SAMPLE.CSV';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast('🧪 テスト用サンプルCSV (INV_LOG_SAMPLE.CSV) をダウンロードしました。ファイル選択から読み込んでお試しください！', 'info', 5000);
};
`;

function appendHtFeatureToApp(filename) {
    let code = fs.readFileSync(filename, 'utf8');
    if (!code.includes('window.openHtImportModal = function')) {
        code += htFeatureJs;
        fs.writeFileSync(filename, code);
        console.log(`Appended HT feature to ${filename}`);
    } else {
        console.log(`HT feature already present in ${filename}`);
    }
}

appendHtFeatureToApp('app.js');
appendHtFeatureToApp('app-mobile.js');

console.log('Done!');
