import os
import csv
import re

# We will collect all missing items from January CSV:
# 1. PAO WORK BOX1人1012BL GO不燃
# 2. PAO CALMDOWN1290R GO
# 3. PAO WORK BOX1人1012SR GO不燃
# 4. PAO WORK BOX1人1012SL GO不燃
# 5. 特注/PAO(1人用)9100002362
# 6. 特注/PAO(4人用)9100002363
# 7. 特注/PAO(6人用)9100002364
# And others like lockers or shelves that had missing codes.

def load_all_csv_items():
    dir_path = "inventory_data"
    files = [f for f in os.listdir(dir_path) if f.endswith('.csv')]
    
    # Map from name to set of codes found in CSVs
    name_to_codes = {}
    
    for filename in files:
        file_path = os.path.join(dir_path, filename)
        try:
            with open(file_path, 'r', encoding='cp932') as f:
                reader = csv.reader(f)
                next(reader) # skip total
                next(reader) # skip header
                for row in reader:
                    if len(row) < 7:
                        continue
                    code = row[4].strip()
                    name = row[6].strip()
                    if name and code:
                        if name not in name_to_codes:
                            name_to_codes[name] = set()
                        name_to_codes[name].add(code)
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            
    return name_to_codes

def search_in_data_js():
    # Read data.js to find any BOM code matches
    data_js_path = "data.js"
    with open(data_js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We want to search for product names and see if we can find their partCodes
    # NEW_BOM_DATA structure has: productName, bomName, partCode etc.
    # Let's write a simple regex or parser to find objects with productName or bomName matching our targets.
    return content

def main():
    missing_names = [
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
    
    csv_mappings = load_all_csv_items()
    data_js_content = search_in_data_js()
    
    print("\n=== Searching for correct codes in CSV files (other months) ===")
    for name in missing_names:
        codes = csv_mappings.get(name, set())
        if codes:
            print(f"Name: '{name}' -> Found codes: {list(codes)}")
        else:
            print(f"Name: '{name}' -> Not found in other CSVs")
            
    print("\n=== Searching for correct codes in data.js (BOM / Products) ===")
    # Look for productName/bomName or partCode in data.js
    # Let's search for substrings of target names
    for name in missing_names:
        # Search for exact name in data.js
        # Also extract adjacent code if found
        matches = []
        # Try to find name in data.js and print some context
        pos = 0
        while True:
            pos = data_js_content.find(name, pos)
            if pos == -1:
                break
            # get context around it
            start = max(0, pos - 150)
            end = min(len(data_js_content), pos + 150)
            context = data_js_content[start:end]
            matches.append(context)
            pos += len(name)
            if len(matches) > 3:
                break
        
        if matches:
            print(f"\nName: '{name}' -> Found in data.js:")
            for idx, m in enumerate(matches):
                print(f"  Match {idx+1}: {repr(m)}")
        else:
            # Try searching with part of the name
            short_name = name.split()[-1] if ' ' in name else name
            # if it contains code like G1IV240BBW1-N, search for that
            model_code = None
            for part in name.split():
                if '-' in part or any(c.isdigit() for c in part) and len(part) > 5:
                    model_code = part
                    break
            
            if model_code:
                pos = data_js_content.find(model_code)
                if pos != -1:
                    start = max(0, pos - 150)
                    end = min(len(data_js_content), pos + 150)
                    context = data_js_content[start:end]
                    print(f"\nName: '{name}' (searched code '{model_code}') -> Found in data.js:")
                    print(f"  Match: {repr(context)}")
                    continue
                    
            print(f"Name: '{name}' -> Not found in data.js")

if __name__ == "__main__":
    main()
