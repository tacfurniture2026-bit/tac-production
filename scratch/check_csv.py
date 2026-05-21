import os
import csv

def main():
    dir_path = "inventory_data"
    files = [f for f in os.listdir(dir_path) if f.endswith('.csv')]
    
    print(f"Found CSV files: {files}")
    
    for filename in files:
        file_path = os.path.join(dir_path, filename)
        print(f"\n--- Checking file: {filename} ---")
        try:
            with open(file_path, 'r', encoding='cp932') as f:
                reader = csv.reader(f)
                header = next(reader) # 合計金額
                header2 = next(reader) # ヘッダー
                
                suspicious_count = 0
                for row_idx, row in enumerate(reader):
                    if len(row) < 7:
                        continue
                    
                    code = row[4].strip()  # 資材コード
                    name = row[6].strip()  # 品名
                    
                    if not code and not name:
                        continue # 完全空行はスキップ
                    
                    is_suspicious = False
                    reason = ""
                    
                    # 1. コードが空で、品名がある
                    if not code and name:
                        is_suspicious = True
                        reason = "Missing Code (Name exists)"
                    # 2. 品名またはコードに「ん」が含まれる
                    elif 'ん' in code or 'ん' in name:
                        is_suspicious = True
                        reason = "Contains 'ん'"
                    # 3. コードまたは品名に "TEMP_" を含む
                    elif 'TEMP' in code or 'TEMP' in name:
                        is_suspicious = True
                        reason = "Contains TEMP"
                        
                    if is_suspicious:
                        suspicious_count += 1
                        print(f"Row {row_idx+3}: Code='{code}', Name='{name}', Reason='{reason}'")
                        print(f"  Full Row (first 10): {row[:10]}")
                
                print(f"Total suspicious items in {filename}: {suspicious_count}")
                        
        except Exception as e:
            print(f"Error reading {filename}: {e}")

if __name__ == "__main__":
    main()
