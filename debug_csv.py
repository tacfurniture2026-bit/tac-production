import csv
with open('inventory_data/【2課】2026年5月棚卸表.csv', 'r', encoding='utf-8', errors='replace') as f:
    for i, row in enumerate(csv.reader(f)):
        for j, col in enumerate(row):
            if '不動品' in col or 'ｲﾋﾞｹﾝ' in col or 'イビケン' in col:
                print(f"Row {i}, Col {j}: {col}")
