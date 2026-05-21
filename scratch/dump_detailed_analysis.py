import os
import csv
import re

def main():
    dir_path = "inventory_data"
    files = [f for f in sorted(os.listdir(dir_path)) if f.endswith('.csv')]
    
    # Missing items list in Jan (Row index in Jan CSV reader loop = Row number - 3)
    missing_targets = [
        # (Row, Name, Remark)
        (956, "PAO WORK BOX1人1012BL GO不燃", ""),
        (957, "PAO WORK BOX1人1012BL GO不燃", ""),
        (958, "PAO CALMDOWN1290R GO", ""),
        (959, "PAO WORK BOX1人1012BL GO不燃", ""),
        (960, "PAO WORK BOX1人1012SR GO不燃", ""),
        (961, "PAO WORK BOX1人1012SL GO不燃", ""),
        (962, "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA", "RGFJLNW-1KKA"),
        (963, "ｼｪﾙﾌ 中方立 H2400 D240用 BW", "G1IV240BBW1-N"),
        (964, "ｼｪﾙﾌ 左右方立 H2400 D240用 BW", "G1HV240BBW2-N"),
        (965, "ｼｪﾙﾌ 施工棚板W800 D240用3枚入 BW", "G1E8003BBW3-N"),
        (966, "ｼｪﾙﾌ 追加棚板 W800 D240用 BW", "G1K8003BBW1-N"),
        (967, "ｼｪﾙﾌ 可動棚板 W800 D240用 BW", "G1S8003BBW1-N"),
        (968, "ｼｪﾙﾌ 中方立 H2400 D380用", "G1IV240AGO1"),
        (969, "ｼｪﾙﾌ 左右方立 H2400 D380", "G1HV240AGO2"),
        (970, "ｼｪﾙﾌ 施工棚板W800 D380用3", "G1E8003AGO3"),
        (971, "ｼｪﾙﾌ 追加棚板 W800 D380用", "G1K8003AGO1"),
        (972, "ｼｪﾙﾌ 可動棚板 W800 D380用", "G1S8003AGO1"),
        (973, "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1BW", "RGFJLNW-1BW"),
        (974, "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1GO", "RGFJLNW-1GO"),
        (975, "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA", "RGFJLNW-1KKA"),
        (976, "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1MPP", "RGFJLNW-1MPP"),
        (977, "木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1WH", "RGFJLNW-1WH"),
        (978, "特注/PAO(1人用)9100002362", ""),
        (979, "特注/PAO(4人用)9100002363", ""),
        (980, "特注/PAO(6人用)9100002364", "")
    ]
    
    # We load all records from all CSVs to build search indices
    all_records = []
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
                    classification_code = row[0].strip() # 識別コード (e.g. 01-023)
                    if name or remark or code:
                        all_records.append({
                            'month': month,
                            'row': idx + 3,
                            'class_code': classification_code,
                            'code': code,
                            'remark': remark,
                            'name': name
                        })
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            
    out_lines = []
    out_lines.append("=== DETAILED SEARCH RESULTS FOR MISSING CODES ===\n")
    
    for row_num, target_name, target_remark in missing_targets:
        out_lines.append(f"\nTarget Row {row_num}: Name='{target_name}', Remark='{target_remark}'")
        
        # 1. Look for EXACT Name match
        exact_matches = []
        for r in all_records:
            if r['name'] == target_name and r['code']:
                exact_matches.append(r)
        
        if exact_matches:
            out_lines.append("  [Exact Name Matches]")
            for m in exact_matches:
                out_lines.append(f"    - Month: {m['month']}, Code: {m['code']}, ClassCode: {m['class_code']}, Remark: {m['remark']}")
        
        # 2. Look for EXACT Remark match if target_remark exists
        if target_remark:
            exact_remarks = []
            for r in all_records:
                if r['remark'] == target_remark and r['code']:
                    exact_remarks.append(r)
            if exact_remarks:
                out_lines.append("  [Exact Remark Matches]")
                for m in exact_remarks:
                    out_lines.append(f"    - Month: {m['month']}, Code: {m['code']}, ClassCode: {m['class_code']}, Name: {m['name']}")
                    
        # 3. Look for partial matches / fuzzy matches
        fuzzy_matches = []
        # clean target_name a bit or extract tokens
        # e.g., if "ｼｪﾙﾌ 可動棚板 W800 D240用 BW", search "可動棚" and "D240"
        search_terms = []
        if "ｼｪﾙﾌ" in target_name:
            # Extract key parts like "中方立", "左右方立", "施工棚", "追加棚", "可動棚" and dimensions
            action = ""
            for term in ["中方立", "左右方立", "施工棚", "追加棚", "可動棚"]:
                if term in target_name:
                    action = term
                    break
            dim = ""
            for d in ["D240", "D380", "W800", "W1200"]:
                if d in target_name:
                    dim = d
                    break
            color = ""
            for c in ["BW", "GO", "SH", "WH", "LO"]:
                if c in target_name:
                    color = c
                    break
            if action:
                search_terms.append(action)
            if dim:
                search_terms.append(dim)
            if color:
                search_terms.append(color)
        elif "木製ﾛｯｶｰ" in target_name:
            # Extract color
            for c in ["BW", "GO", "KKA", "WH", "MPP"]:
                if c in target_name:
                    search_terms.append("木製ﾛｯｶｰ")
                    search_terms.append("Wﾊﾟｰﾂ1")
                    search_terms.append(c)
                    break
        elif "PAO" in target_name:
            # Extract color and dimensions
            for c in ["BL", "BR", "SL", "SR", "WH", "GO"]:
                if c in target_name:
                    search_terms.append(c)
            for d in ["1012", "1290", "1618", "1218"]:
                if d in target_name:
                    search_terms.append(d)
                    
        if search_terms:
            for r in all_records:
                if r['code'] and all(term.lower() in r['name'].lower() or term.lower() in r['remark'].lower() for term in search_terms):
                    # check it's not already in exact matches
                    if not any(e['code'] == r['code'] for e in exact_matches):
                        fuzzy_matches.append(r)
            if fuzzy_matches:
                out_lines.append("  [Fuzzy Matches (matching: " + ", ".join(search_terms) + ")]")
                # Keep unique codes to avoid spam
                seen_codes = set()
                for m in fuzzy_matches:
                    if m['code'] not in seen_codes:
                        seen_codes.add(m['code'])
                        out_lines.append(f"    - Month: {m['month']}, Code: {m['code']}, ClassCode: {m['class_code']}, Name: {m['name']}, Remark: {m['remark']}")
                        
    # Write to a scratch file
    out_path = "scratch/analysis_results.txt"
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(out_lines))
    print(f"Analysis saved to {out_path}")

if __name__ == "__main__":
    main()
