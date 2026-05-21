import os
import csv

def main():
    dir_path = "inventory_data"
    files = [f for f in sorted(os.listdir(dir_path)) if f.endswith('.csv')]
    
    # Store all unique (name, remark, code) tuples across all months
    # We want to map name and/or remark to code
    mapping = []
    
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
                    classification_code = row[0].strip() # 識別コード
                    if name or remark or code:
                        mapping.append({
                            'month': month,
                            'row': idx + 3,
                            'class_code': classification_code,
                            'code': code,
                            'remark': remark,
                            'name': name
                        })
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            
    print(f"Loaded {len(mapping)} records.")
    
    # 1. Search for 木製ロッカー series
    print("\n=== 木製ロッカー (RGFJLNW) Mappings ===")
    for item in mapping:
        if 'RGFJLNW' in item['name'] or 'RGFJLNW' in item['remark']:
            if item['code']:
                print(f"[{item['month']}] Name: '{item['name']}', Remark: '{item['remark']}', Code: '{item['code']}', ClassCode: '{item['class_code']}'")
                
    # 2. Search for PAO series
    print("\n=== PAO Mappings ===")
    for item in mapping:
        if 'PAO' in item['name'] or 'PAO' in item['remark']:
            if item['code']:
                print(f"[{item['month']}] Name: '{item['name']}', Remark: '{item['remark']}', Code: '{item['code']}', ClassCode: '{item['class_code']}'")

    # 3. Search for シェルフ series
    print("\n=== シェルフ (ｼｪﾙﾌ / G1) Mappings ===")
    for item in mapping:
        if 'ｼｪﾙﾌ' in item['name'] or 'G1' in item['remark'] or 'G1' in item['name']:
            if item['code']:
                print(f"[{item['month']}] Name: '{item['name']}', Remark: '{item['remark']}', Code: '{item['code']}', ClassCode: '{item['class_code']}'")

if __name__ == "__main__":
    main()
