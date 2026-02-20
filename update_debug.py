
def main():
    with open('app.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # 1. Insert logToDebug function at top (or near top)
    # Find a good place, e.g. after DOMContentLoaded or main constants.
    # Let's put it before onQrCodeScanned.
    
    insert_idx = -1
    for i, line in enumerate(lines):
        if "function onQrCodeScanned" in line:
            insert_idx = i
            break
            
    if insert_idx == -1: return

    debug_func = """function logToDebug(msg) {
    const el = document.getElementById('debug-log');
    if (el) {
        el.style.display = 'block';
        const now = new Date().toLocaleTimeString();
        el.innerHTML = `<div style="border-bottom:1px solid #eee;">[${now}] ${msg}</div>` + el.innerHTML;
    }
    console.log(msg);
}
"""
    lines.insert(insert_idx, debug_func)

    # 2. Instrument selectFromQrData
    # Find the function body
    func_start = -1
    for i, line in enumerate(lines):
        if "function selectFromQrData" in line:
            func_start = i
            break
            
    if func_start == -1: return
    
    # We want to insert logging inside.
    # Actually, let's just replace the whole function again with logging enabled version.
    # It's safer than inserting lines randomly.
    
    # Find end of function
    # Same logic as before
    brace_count = 0
    found_start = False
    func_end = -1
    for i in range(func_start, len(lines)):
        line = lines[i]
        brace_count += line.count('{')
        brace_count -= line.count('}')
        if brace_count > 0: found_start = True
        if found_start and brace_count == 0:
            func_end = i + 1
            break
            
    if func_end == -1: return
    
    new_select_qr = """function selectFromQrData(projectName, productName, bomName) {
  const orders = DB.get(DB.KEYS.ORDERS) || [];
  logToDebug(`Matching... Scan: "${projectName}" / "${productName}" (DB: ${orders.length} orders)`);

  const normalize = s => (s || '').trim().replace(/\\s+/g, '').replace(/[\\uFF01-\\uFF5E]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)).toLowerCase();
  
  const pNameNorm = normalize(projectName);
  const prodNameNorm = normalize(productName);
  const bomNameNorm = normalize(bomName);

  // 1. Strict
  let order = orders.find(o => 
      o.projectName.includes(projectName) && o.productName.includes(productName)
  );
  
  if (order) logToDebug(`Strict match found: ID=${order.id}`);

  // 2. Fuzzy
  if (!order) {
      order = orders.find(o => 
          normalize(o.projectName).includes(pNameNorm) && normalize(o.productName).includes(prodNameNorm)
      );
      if (order) logToDebug(`Fuzzy match found: ID=${order.id} (${order.projectName})`);
  }

  if (!order) {
     logToDebug("No match found.");
     // Partial check
     const pMatch = orders.find(o => normalize(o.projectName).includes(pNameNorm));
     if (pMatch) logToDebug(`Partial: Project OK (${pMatch.projectName}), Product fail.`);
     else logToDebug("Partial: Project fail.");
     
     toast(`該当データなし (現場: ${projectName}, 品名: ${productName})`, 'warning');
     return;
  }
  
  // Select Order
  const orderSelect = document.getElementById('qr-order');
  if (orderSelect) {
      // Create option if missing? Be careful.
      // Check if option exists
      const opt = orderSelect.querySelector(`option[value="${order.id}"]`);
      if (!opt) {
          logToDebug(`Option for ID=${order.id} missing in select! Adding it.`);
          const newOpt = document.createElement('option');
          newOpt.value = order.id;
          newOpt.text = `${order.projectName} - ${order.productName}`;
          orderSelect.add(newOpt);
      }
      orderSelect.value = order.id;
      // Trigger change event if needed? No, updateQrItemSelect reads value.
      logToDebug(`Selected Order ID: ${order.id}`);
  } else {
      logToDebug("Error: #qr-order select not found");
  }

  updateQrItemSelect(); 

  // Select Item
  setTimeout(() => {
    let item = order.items?.find(i => 
       i.bomName.includes(bomName) || (i.partCode && i.partCode.includes(bomName))
    );
    
    if (!item && bomNameNorm) {
        item = order.items?.find(i => 
           normalize(i.bomName).includes(bomNameNorm) || (i.partCode && normalize(i.partCode).includes(bomNameNorm))
        );
    }

    if (item) {
       const itemSelect = document.getElementById('qr-item');
       if (itemSelect) {
           itemSelect.value = item.id;
           logToDebug(`Selected Item ID: ${item.id}`);
       }
       updateQrProcessSelect();
       toast(`指示書と部材を選択しました`, 'success');
    } else {
       logToDebug(`Item not found for BOM: ${bomName}`);
       toast(`部材が見つかりません: ${bomName}`, 'warning');
    }
  }, 100);
}
"""
    lines[func_start:func_end] = [new_select_qr]

    with open('app.js', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Success")

if __name__ == "__main__":
    main()
