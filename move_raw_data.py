
def main():
    with open('app.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()

    func_start_idx = -1
    for i, line in enumerate(lines):
        if "function onQrCodeScanned(decodedText, decodedResult) {" in line:
            func_start_idx = i
            break
            
    if func_start_idx == -1:
        print("Function start not found")
        return

    insert_idx = -1
    for i in range(func_start_idx, len(lines)):
        if "try {" in lines[i]:
            insert_idx = i + 1
            break
            
    if insert_idx == -1:
        print("try block not found")
        return

    insertion = """      // Define safeSet helper early
      const safeSet = (id, val) => {
         const el = document.getElementById(id);
         if (el) el.value = val;
      };
      
      console.log('Force Raw Data:', decodedText);
      safeSet('qr-raw-data', decodedText);
"""
    
    final_lines = lines[:insert_idx] + [insertion]
    
    skip_count = 0
    # Process lines AFTER the insertion point (old function body)
    for i in range(insert_idx, len(lines)):
        if skip_count > 0:
            skip_count -= 1
            continue
            
        line = lines[i]
        # Remove old definition (4 lines)
        if "const safeSet = (id, val) => {" in line:
            skip_count = 3
            continue
        
        # Remove old call
        if "safeSet('qr-raw-data', decodedText);" in line:
            continue # remove duplicates
            
        final_lines.append(line)
        
    with open('app.js', 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
    print("Success")

if __name__ == "__main__":
    main()
