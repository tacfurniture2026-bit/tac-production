import urllib.request
import json
import os
import csv

def try_firebase_nodes():
    nodes = ['inv_products', 'pms_inv_products', 'products', 'pms_inv_scan_temp', 'inv_scan_temp']
    base_url = "https://tac-production-bfd08-default-rtdb.asia-southeast1.firebasedatabase.app"
    
    print("=== Probing Firebase RTDB Public Access ===")
    for node in nodes:
        url = f"{base_url}/{node}.json"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode('utf-8'))
                    print(f"Success GET {node}: {len(data) if data else 0} records")
                    # If success, dump to a file
                    with open(f"scratch/fb_{node}.json", 'w', encoding='utf-8') as out:
                        json.dump(data, out, ensure_ascii=False, indent=2)
                else:
                    print(f"Status {response.status} for {node}")
        except Exception as e:
            print(f"Failed to fetch {node}: {e}")

def dump_csv_special_codes():
    dir_path = "inventory_data"
    files = [f for f in sorted(os.listdir(dir_path)) if f.endswith('.csv')]
    
    unique_items = {}
    
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
                    classification_code = row[0].strip()
                    if code:
                        # We are interested in N120... and N260... codes
                        if code.startswith('N12') or code.startswith('N26') or code.startswith('N06'):
                            key = (code, name, remark)
                            if key not in unique_items:
                                unique_items[key] = []
                            unique_items[key].append(month)
        except Exception as e:
            print(f"Error reading {filename}: {e}")
            
    print(f"\n=== Dump of N12, N26, N06 codes from CSVs ===")
    # Sort by code
    for (code, name, remark), months in sorted(unique_items.items(), key=lambda x: x[0][0]):
        print(f"Code: '{code}' | Name: '{name}' | Remark: '{remark}' | Months: {months}")

if __name__ == "__main__":
    try_firebase_nodes()
    dump_csv_special_codes()
