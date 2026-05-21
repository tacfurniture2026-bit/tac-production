import os
import csv

def main():
    dir_path = "inventory_data"
    files = [f for f in sorted(os.listdir(dir_path)) if f.endswith('.csv')]
    
    model_codes = [
        "G1IV240BBW1-N",
        "G1HV240BBW2-N",
        "G1E8003BBW3-N",
        "G1K8003BBW1-N",
        "G1S8003BBW1-N",
        "G1IV240AGO1",
        "G1HV240AGO2",
        "G1E8003AGO3",
        "G1K8003AGO1",
        "G1S8003AGO1",
        "RGFJLNW-1BW",
        "RGFJLNW-1GO",
        "RGFJLNW-1MPP",
        "RGFJLNW-1KKA",
        "RGFJLNW-1WH",
        "9100002362",
        "9100002363",
        "9100002364",
        "CALMDOWN1290R",
        "1012SR GO",
        "1012SL GO",
        "1012BL GO"
    ]
    
    out_lines = []
    out_lines.append("=== SEARCHING CSV FILES BY MODEL CODES ===\n")
    
    for code_target in model_codes:
        out_lines.append(f"\n--- Model Code: {code_target} ---")
        matches = []
        for filename in files:
            file_path = os.path.join(dir_path, filename)
            month = filename.replace("【2課】", "").replace("棚卸表.csv", "")
            try:
                with open(file_path, 'r', encoding='cp932') as f:
                    reader = csv.reader(f)
                    next(reader)
                    next(reader)
                    for idx, row in enumerate(reader):
                        if len(row) < 7:
                            continue
                        code = row[4].strip()
                        remark = row[5].strip()
                        name = row[6].strip()
                        class_code = row[0].strip()
                        
                        # Match if code_target is in name, remark or classification code
                        if (code_target.lower() in name.lower() or 
                            code_target.lower() in remark.lower() or 
                            code_target.lower() in class_code.lower()):
                            matches.append({
                                'month': month,
                                'row': idx + 3,
                                'code': code,
                                'remark': remark,
                                'name': name,
                                'class_code': class_code
                            })
            except Exception as e:
                pass
                
        if matches:
            for m in matches:
                out_lines.append(f"  [{m['month']} Row {m['row']}] Code: '{m['code']}' | ClassCode: '{m['class_code']}' | Name: '{m['name']}' | Remark: '{m['remark']}'")
        else:
            out_lines.append("  No matches found in any CSV.")
            
    # Also search fb_inv_products.json
    out_lines.append("\n\n=== SEARCHING FIREBASE MASTER BY MODEL CODES ===\n")
    try:
        with open("scratch/fb_inv_products.json", 'r', encoding='utf-8') as f:
            products = json.load(f)
            
        flat_products = []
        if isinstance(products, dict):
            for k, v in products.items():
                if isinstance(v, dict):
                    v['fb_key'] = k
                    flat_products.append(v)
        elif isinstance(products, list):
            for idx, item in enumerate(products):
                if item and isinstance(item, dict):
                    item['fb_idx'] = idx
                    flat_products.append(item)
                    
        for code_target in model_codes:
            out_lines.append(f"\n--- Model Code: {code_target} ---")
            fb_matches = []
            for p in flat_products:
                pid = p.get('id', '')
                pname = p.get('name', '')
                # category = p.get('category', '')
                if (code_target.lower() in pid.lower() or 
                    code_target.lower() in pname.lower()):
                    fb_matches.append(p)
            if fb_matches:
                for fm in fb_matches:
                    out_lines.append(f"  FB ID: '{fm.get('id')}' | Name: '{fm.get('name')}'")
            else:
                out_lines.append("  No matches found in Firebase Master.")
    except Exception as e:
        out_lines.append(f"Error reading Firebase Master: {e}")
        
    with open("scratch/model_code_search_results.txt", 'w', encoding='utf-8') as out:
        out.write("\n".join(out_lines))
        
    print("Search results saved to scratch/model_code_search_results.txt")

if __name__ == "__main__":
    main()
