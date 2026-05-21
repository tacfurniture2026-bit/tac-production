import os
import csv

def main():
    dir_path = "inventory_data"
    files = [f for f in sorted(os.listdir(dir_path)) if f.endswith('.csv')]
    
    order_nos = [
        "9100003406", "9100003369", "9100003370", "9100003807", "9100003635", "9100003636",
        "2100009091-1", "2100009229-1", "2100009229-2", "2100009229-3", "2100009229-4", "2100009229-5",
        "2100009233-1", "2100009233-2", "2100009233-3", "2100009233-4", "2100009233-5",
        "2100009534-1", "2100009534-4", "2100009534-7", "2100009534-10", "2100009534-13",
        "9100002362", "9100002363", "9100002364"
    ]
    
    out_lines = []
    out_lines.append("=== SEARCHING CSV FILES BY ORDER NUMBERS ===\n")
    
    for order_target in order_nos:
        out_lines.append(f"\n--- Order Number: {order_target} ---")
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
                        if len(row) < 25: # Row must be long enough
                            continue
                        
                        # Order number can be in column index 24 (row[24]) or maybe 23
                        # Let's search all columns for the order target
                        found_col = -1
                        for col_idx, val in enumerate(row):
                            if order_target in val:
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
            for m in matches:
                out_lines.append(f"  [{m['month']} Row {m['row']}] Code: '{m['code']}' | ClassCode: '{m['class_code']}' | Name: '{m['name']}' | Remark: '{m['remark']}' | Match in Col {m['col_idx']}: '{m['col_val']}'")
        else:
            out_lines.append("  No matches found in any CSV.")
            
    with open("scratch/order_no_search_results.txt", 'w', encoding='utf-8') as out:
        out.write("\n".join(out_lines))
        
    print("Search results saved to scratch/order_no_search_results.txt")

if __name__ == "__main__":
    main()
