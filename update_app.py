
import os

def main():
    with open('app.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Lines to replace: 716 to 833 (1-based) -> Indices 715 to 833 (slice starts at 715, ends at 833 to cut 715..832)
    # Check if line 715 starts with "function onQrCodeScanned"
    if "function onQrCodeScanned" not in lines[715]:
        print("Error: Line 716 check failed:", lines[715])
        # Search for it
        for i, line in enumerate(lines):
            if "function onQrCodeScanned" in line:
                print(f"Found at line {i+1}")
                # We could adjust, but let's be strict for safety
                return

    # Check termination
    # Line 833 is "}"
    # lines[832]
    
    new_function = r"""function onQrCodeScanned(decodedText, decodedResult) {
  try {
      console.log(`QR Scanned: ${decodedText}`);
      // Debug toast
      const debugMsg = decodedText.length > 20 ? decodedText.substring(0, 20) + '...' : decodedText;
      toast(`読取成功: ${debugMsg}`, 'success');

      // Stop scanner
      stopQrScanner();

      const resultDiv = document.getElementById('qr-scan-result');
      const dataDiv = document.getElementById('qr-scan-data');
      if (resultDiv) resultDiv.style.display = 'block';

      // Parse
      let projectName = '';
      let productName = '';
      let bomName = '';
      let parsed = false;

      // 1. JSON
      try {
        const json = JSON.parse(decodedText);
        if (json.project || json.projectName) {
          projectName = (json.project || json.projectName || '').trim();
          productName = (json.product || json.productName || '').trim();
          bomName = (json.bom || json.bomName || json.item || '').trim();
          parsed = true;
        }
      } catch (e) { }

      // 2. Delimiter
      if (!parsed) {
        const parts = decodedText.split(/[|\t]/);
        if (parts.length >= 3) {
          projectName = parts[0].trim();
          productName = parts[1].trim();
          bomName = parts[2].trim();
          parsed = true;
        } else {
          const commaParts = decodedText.split(',');
          if (commaParts.length >= 3) {
            projectName = commaParts[0].trim();
            productName = commaParts[1].trim();
            bomName = commaParts[2].trim();
            parsed = true;
          }
        }
      }

      // 3. Two parts
      if (!parsed) {
        const parts2 = decodedText.split(/[|,\t]/);
        if (parts2.length === 2) {
          productName = parts2[0].trim();
          bomName = parts2[1].trim();
          parsed = true;
        }
      }

      // 4. Single string search
      if (!parsed) {
        const orders = DB.get(DB.KEYS.ORDERS) || [];
        const searchText = decodedText.trim();
        const matchOrder = orders.find(o =>
          o.orderNo === searchText ||
          o.projectName === searchText ||
          o.productName === searchText ||
          (o.items && o.items.some(i => i.bomName === searchText || i.partCode === searchText))
        );

        if (matchOrder) {
          projectName = matchOrder.projectName;
          productName = matchOrder.productName;
          const matchItem = matchOrder.items?.find(i => i.bomName === searchText || i.partCode === searchText);
          if (matchItem) bomName = matchItem.bomName;
          parsed = true;
        }
      }

      // Display and Auto Transcription
      if (dataDiv) {
        if (parsed && (projectName || productName || bomName)) {
          dataDiv.innerHTML = `
            ${projectName ? `<div><strong>現場名:</strong> ${projectName}</div>` : ''}
            ${productName ? `<div><strong>品名:</strong> ${productName}</div>` : ''}
            ${bomName ? `<div><strong>部材:</strong> ${bomName}</div>` : ''}
          `;
          
          const safeSet = (id, val) => {
             const el = document.getElementById(id);
             if (el) el.value = val;
          };
          safeSet('qr-project-name', projectName || '');
          safeSet('qr-product-name', productName || '');
          safeSet('qr-bom-name', bomName || '');
          
        } else {
          dataDiv.innerHTML = `<div>読取データ: ${decodedText}</div>`;
        }
      }

      // Auto Select
      if (parsed && (projectName || productName)) {
        selectFromQrData(projectName, productName, bomName);
      } else {
        toast('データが見つかりませんでした (転記不可)', 'warning');
      }

      // Vibrate
      if (navigator.vibrate) {
        try { navigator.vibrate(100); } catch(e){}
      }
      
  } catch (e) {
      console.error('QR Scan Error:', e);
      alert('エラー: ' + e.message);
      toast('システムエラー: ' + e.message, 'error');
  }
}
""" + "\n"

    # Slice: lines[:715] + [new_function] + lines[833:]
    # lines indices: 0..N-1. Line 716 is index 715.
    # 715 is included in prefix? No, we replace it.
    # lines[:715] contains 0..714 (Line 1..715).
    # We want to replace 716..833.
    # So we remove indices 715..832.
    # lines[833:] starts at index 833 (Line 834).
    
    new_content = lines[:715] + [new_function] + lines[833:]
    
    with open('app.js', 'w', encoding='utf-8') as f:
        f.writelines(new_content)
    
    print("Successfully updated app.js")

if __name__ == "__main__":
    main()
