import csv
import os

def main():
    file_path = "inventory_data/【2課】2026年1月棚卸表.csv"
    backup_path = "inventory_data/【2課】2026年1月棚卸表.csv.bak"
    
    # Create backup first
    if not os.path.exists(backup_path):
        with open(file_path, 'r', encoding='cp932') as src:
            with open(backup_path, 'w', encoding='cp932') as dst:
                dst.write(src.read())
        print("Created backup of January CSV.")
        
    with open(file_path, 'r', encoding='cp932') as f:
        reader = list(csv.reader(f))
        
    # Mapping definition: (Row Number 1-based, ClassCode, Classification, Code)
    updates = {
        956: ("26-036", "26", "N26000000000036"), # PAO WORK BOX1人1012BL GO不燃
        957: ("26-036", "26", "N26000000000036"), # PAO WORK BOX1人1012BL GO不燃
        959: ("26-036", "26", "N26000000000036"), # PAO WORK BOX1人1012BL GO不燃
        960: ("26-021", "26", "N26000000000021"), # PAO WORK BOX1人1012SR GO不燃
        962: ("26-023", "26", "N26000000000023"), # 木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA
        972: ("12-205", "12", "N12000000000205"), # ｼｪﾙﾌ 可動棚板 W800 D380用 (G1S8003AGO1)
        973: ("12-161", "12", "N12000000000161"), # 木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1BW
        974: ("12-192", "12", "N12000000000192"), # 木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1GO
        975: ("26-023", "26", "N26000000000023"), # 木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA
        977: ("26-026", "26", "N26000000000026")  # 木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1WH
    }
    
    print("\n=== Updating January CSV ===")
    for row_num, (class_code, classification, code) in updates.items():
        # row index is row_num - 1
        row = reader[row_num - 1]
        print(f"Row {row_num} BEFORE: {row[:8]}")
        
        # row[0] is ClassCode
        # row[1] is Classification
        # row[4] is Code
        row[0] = class_code
        row[1] = classification
        row[4] = code
        
        print(f"Row {row_num} AFTER: {row[:8]}")
        
    # Write back to CSV
    with open(file_path, 'w', encoding='cp932', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(reader)
        
    print("\nJanuary CSV file has been updated successfully.")

if __name__ == "__main__":
    main()
