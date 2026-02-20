
def main():
    with open('app.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 1. Update selectFromQrData
    # Find start and end
    start_idx = -1
    for i, line in enumerate(lines):
        if "function selectFromQrData(projectName, productName, bomName) {" in line:
            start_idx = i
            break
            
    if start_idx != -1:
        # Find end (closing brace) - Basic heuristic (indentation based or matching brackets)
        # Function level is usually 0 indentation in app.js? No, usually not indented.
        # But let's assume valid indentation.
        # It's better to find the start of next function "function "
        end_idx = -1
        for i in range(start_idx + 1, len(lines)):
            if lines[i].startswith("function "):
                end_idx = i
                break
        
        # If not found, maybe it's the last function?
        if end_idx == -1: end_idx = len(lines)
        
        # But we need to keep the next function.
        # Check matching braces is better.
        # Or Just replace the content.
        
        # New Content
        new_select_qr = """function selectFromQrData(projectName, productName, bomName) {
  const orders = DB.get(DB.KEYS.ORDERS);
  const normalize = s => (s || '').trim().replace(/\\s+/g, '').replace(/[\\uFF01-\\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).toLowerCase(); // Normalize spaces and full-width
  
  const pNameNorm = normalize(projectName);
  const prodNameNorm = normalize(productName);
  const bomNameNorm = normalize(bomName);

  // 1. Strict Match
  let order = orders.find(o => 
      o.projectName.includes(projectName) && o.productName.includes(productName)
  );
  
  // 2. Fuzzy Match (attributes normalized)
  if (!order) {
      order = orders.find(o => 
          normalize(o.projectName).includes(pNameNorm) && normalize(o.productName).includes(prodNameNorm)
      );
  }

  if (!order) {
     // Debug finding
     const pMatch = orders.find(o => normalize(o.projectName).includes(pNameNorm));
     const prodMatch = orders.find(o => normalize(o.productName).includes(prodNameNorm));
     
     if (pMatch && !prodMatch) {
         toast(`現場名は一致しましたが、品名が一致しません: ${productName}`, 'warning');
     } else if (!pMatch && prodMatch) {
         toast(`品名は一致しましたが、現場名が一致しません: ${projectName}`, 'warning');
     } else {
         toast(`該当データなし (現場: ${projectName}, 品名: ${productName}) - 転記のみ実行`, 'warning');
     }
     return;
  }
  
  // Found!
  // Select Order
  const orderSelect = document.getElementById('qr-order');
  if (orderSelect) orderSelect.value = order.id;
  updateQrItemSelect(); 

  // Select Item (Bom)
  setTimeout(() => {
    let item = order.items?.find(i => 
       i.bomName.includes(bomName) || (i.partCode && i.partCode.includes(bomName))
    );
    
    if (!item && bomNameNorm) {
        // Fuzzy item match
        item = order.items?.find(i => 
           normalize(i.bomName).includes(bomNameNorm) || (i.partCode && normalize(i.partCode).includes(bomNameNorm))
        );
    }

    if (item) {
       const itemSelect = document.getElementById('qr-item');
       if (itemSelect) itemSelect.value = item.id;
       
       updateQrProcessSelect();
       toast(`指示書と部材を選択しました。工程ボタンを押して登録してください。`, 'success');
    } else {
       toast(`指示書は見つかりましたが、部材が見つかりません: ${bomName}`, 'warning');
    }
  }, 100);
}
"""
        # We replace lines[start_idx : end_idx] ? No, end_idx is start of next function.
        # But there might be blank lines.
        # Let's count braces to find end of function strictly.
        
        brace_count = 0
        found_start = False
        actual_end_idx = -1
        for i in range(start_idx, len(lines)):
            line = lines[i]
            brace_count += line.count('{')
            brace_count -= line.count('}')
            if brace_count > 0: found_start = True
            if found_start and brace_count == 0:
                actual_end_idx = i + 1
                break
        
        if actual_end_idx != -1:
            lines[start_idx:actual_end_idx] = [new_select_qr]
        else:
             print("Could not find end of selectFromQrData")
             return

    # 2. Update selectProcess
    # Need to re-scan indices because lines changed
    # Just write the file and read it again? No, simpler to do 2 passes in 2 scripts if unsure, but let's try.
    # We replaced a chunk, so subsequent indices are shifted.
    # Calculate shift?
    # Or just use the string matching on `lines` (which is modified list).
    
    # Actually, easier:
    # `lines` is a list of strings.
    # `lines[start:end] = [string]` works.
    # Python list handles shifting.
    # So we just need to find the new index.
    
    start_idx_2 = -1
    for i, line in enumerate(lines):
        if "function selectProcess(btn, processName) {" in line:
            start_idx_2 = i
            break
            
    if start_idx_2 != -1:
         new_select_process = """function selectProcess(btn, processName) {
  // 1. UI Feedback (Instant)
  const container = btn.closest('.process-btn-grid');
  if (container) {
    container.querySelectorAll('.process-btn').forEach(b => b.classList.remove('selected'));
  }
  btn.classList.add('selected');
  // Add temporary processing state
  btn.style.opacity = '0.7';
  btn.innerText = '登録中...';

  // 2. Get Data
  const orderId = parseInt(document.getElementById('qr-order').value);
  const itemId = parseInt(document.getElementById('qr-item').value);
  
  if (!orderId || !itemId) {
      toast('指示書と部材が選択されていません', 'error');
      btn.style.opacity = '1';
      btn.innerText = processName;
      return;
  }

  // 3. Register (Async simulation)
  // registerProgress retrieves from DB and calls save. It is synchronous in this app (localStorage/Firebase shim).
  // But if Firebase is real, it might take time?
  // Current app.js registerProgress handles DB.
  
  const success = registerProgress(orderId, itemId, processName);
  
  if (success) {
      toast(`${processName} を完了として登録しました`, 'success');
      btn.classList.add('completed');
      btn.innerText = `✓ ${processName}`;
      btn.disabled = true;
      btn.style.opacity = '1';
      
      // Vibrate
      if (navigator.vibrate) try { navigator.vibrate(50); } catch(e){}
  } else {
      toast('登録に失敗しました', 'error');
      btn.style.opacity = '1';
      btn.innerText = processName;
  }
}
"""
         brace_count = 0
         found_start = False
         actual_end_idx_2 = -1
         for i in range(start_idx_2, len(lines)):
            line = lines[i]
            brace_count += line.count('{')
            brace_count -= line.count('}')
            if brace_count > 0: found_start = True
            if found_start and brace_count == 0:
                actual_end_idx_2 = i + 1
                break
         
         if actual_end_idx_2 != -1:
             lines[start_idx_2:actual_end_idx_2] = [new_select_process]
         else:
             print("Could not find end of selectProcess")
             return

    with open('app.js', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Success")

if __name__ == "__main__":
    main()
