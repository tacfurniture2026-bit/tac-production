import os
import csv

def main():
    dir_path = "inventory_data"
    files = [f for f in sorted(os.listdir(dir_path)) if f.endswith('.csv')]
    
    base_orders = [
        "2100009534",
        "2100009229",
        "2100009233",
        "2100009091",
        "9100002362",
        "9100002363",
        "9100002364",
        "9100003406",
        "9100003369",
        "9100003370",
        "9100003807",
        "9100003635",
        "9100003636"
    ]
    
    out_lines = []
    out_lines.append("=== SEARCHING CSV FILES BY BASE ORDER NUMBERS ===\n")
    
    for base in base_orders:
        out_lines.append(f"\n--- Base Order: {base} ---")
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
                        if len(row) < 25:
                            continue
                        
                        # Check columns: we search all columns for the base order number
                        found_col = -1
                        for col_idx, val in enumerate(row):
                            if base in val:
                                found_col = col_idx
                                break
                                
                        if found_col != -1:
                            code = row[4].strip()
                            remark = row[5].strip()
                            name = row[6].strip()
                            class_code = row[0].strip()
                            matches.append({
                                'month': month,
                                'row': idx + 3,
                                'code': code,
                                'remark': remark,
                                'name': name,
                                'class_code': class_code,
                                'col_idx': found_col,
                                'col_val': row[found_col]
                            })
            except Exception as e:
                pass
                
        if matches:
            # We filter duplicate prints if they are exactly the same month/row/code
            seen = set()
            for m in matches:
                key = (m['month'], m['row'], m['code'])
                if key not in seen:
                    seen.add(key)
                    out_lines.append(f"  [{m['month']} Row {m['row']}] Code: '{m['code']}' | ClassCode: '{m['class_code']}' | Name: '{m['name']}' | Remark: '{m['remark']}' | Match in Col {m['col_idx']}: '{m['col_val']}'")
        else:
            out_lines.append("  No matches found in any CSV.")
            
    with open("scratch/base_order_search_results.txt", 'w', encoding='utf-8') as out:
        out.write("\n".join(out_lines))
        
    print("Search results saved to scratch/base_order_search_results.txt")

if __name__ == "__main__":
    main()
