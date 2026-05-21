import csv

def main():
    file_path = "inventory_data/【2課】2026年1月棚卸表.csv"
    with open(file_path, 'r', encoding='cp932') as f:
        reader = list(csv.reader(f))
        
    print("=== Context from January CSV (rows 940 to 990) ===")
    for idx in range(940, 990):
        if idx < len(reader):
            row = reader[idx]
            # row index in 0-indexed list is row_number - 1
            # print Row number (1-based)
            print(f"Row {idx+1}: {row}")

if __name__ == "__main__":
    main()
