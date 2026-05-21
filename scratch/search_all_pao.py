import os
import csv

def main():
    dir_path = "inventory_data"
    files = [f for f in os.listdir(dir_path) if f.endswith('.csv')]
    
    keywords = ['RGFJLNW', 'PAO', 'ｼｪﾙﾌ', 'CALMDOWN', '特注']
    
    for keyword in keywords:
        print(f"\n==========================================")
        print(f"Keyword: {keyword}")
        print(f"==========================================")
        matches = {}
        for filename in files:
            file_path = os.path.join(dir_path, filename)
            month = filename.replace("【2課】", "").replace("棚卸表.csv", "")
            try:
                with open(file_path, 'r', encoding='cp932') as f:
                    reader = csv.reader(f)
                    next(reader)
                    next(reader)
                    for row in reader:
                        if len(row) < 7:
                            continue
                        code = row[4].strip()
                        name = row[6].strip()
                        remark = row[5].strip()
                        if keyword.lower() in name.lower() or keyword.lower() in code.lower() or keyword.lower() in remark.lower():
                            if name not in matches:
                                matches[name] = []
                            matches[name].append({
                                'month': month,
                                'code': code,
                                'remark': remark,
                                'row': row[:10]
                            })
            except Exception as e:
                print(f"Error reading {filename}: {e}")
                
        for name, occurrences in sorted(matches.items()):
            print(f"\n品名: {name}")
            # Unique codes/remarks
            unique_codes = set(occ['code'] for occ in occurrences if occ['code'])
            unique_remarks = set(occ['remark'] for occ in occurrences if occ['remark'])
            print(f"  検出されたコード: {list(unique_codes)}")
            print(f"  検出された備考: {list(unique_remarks)}")
            for occ in occurrences:
                print(f"    [{occ['month']}] コード='{occ['code']}', 備考='{occ['remark']}'")

if __name__ == "__main__":
    main()
