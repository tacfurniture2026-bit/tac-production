import os
import csv

def main():
    dir_path = "inventory_data"
    files = [f for f in sorted(os.listdir(dir_path)) if f.endswith('.csv')]
    
    missing_targets = [
        "PAO WORK BOX1人1012BL GO不燃",
        "PAO CALMDOWN1290R GO",
        "PAO WORK BOX1人1012SR GO不燃",
        "PAO WORK BOX1人1012SL GO不燃",
        "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA",
        "ｼｪﾙﾌ 中方立 H2400 D240用 BW",
        "ｼｪﾙﾌ 左右方立 H2400 D240用 BW",
        "ｼｪﾙﾌ 施工棚板W800 D240用3枚入 BW",
        "ｼｪﾙﾌ 追加棚板 W800 D240用 BW",
        "ｼｪﾙﾌ 可動棚板 W800 D240用 BW",
        "ｼｪﾙﾌ 中方立 H2400 D380用",
        "ｼｪﾙﾌ 左右方立 H2400 D380",
        "ｼｪﾙﾌ 施工棚板W800 D380用3",
        "ｼｪﾙﾌ 追加棚板 W800 D380用",
        "ｼｪﾙﾌ 可動棚板 W800 D380用",
        "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1BW",
        "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1GO",
        "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1MPP",
        "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1WH",
        "特注/PAO(1人用)9100002362",
        "特注/PAO(4人用)9100002363",
        "特注/PAO(6人用)9100002364"
    ]
    
    out_lines = []
    out_lines.append("=== SEARCHING ALL CSV FILES FOR TARGETS ===\n")
    
    for target in missing_targets:
        out_lines.append(f"\n--- Target: {target} ---")
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
                        
                        # Match by exact name or if name contains the model code
                        # We also search fuzzy
                        is_match = False
                        if target.lower() in name.lower():
                            is_match = True
                        elif target in name or (remark and remark in target):
                            is_match = True
                            
                        # Extract model codes from targets like G1IV240BBW1-N and match
                        model_codes = []
                        if "G1" in target:
                            # Try to extract the G1... code if we know it
                            pass
                            
                        if is_match and code:
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
            
    # Write to a file
    with open("scratch/csv_search_results.txt", 'w', encoding='utf-8') as out:
        out.write("\n".join(out_lines))
        
    print("CSV search results written to scratch/csv_search_results.txt")

if __name__ == "__main__":
    main()
