import csv
import json
import os
import glob
from datetime import datetime

months = {
    '1月': '2026-01',
    '2月': '2026-02',
    '3月': '2026-03',
    '4月': '2026-04'
}

monthly_data = []

csv_files = glob.glob('inventory_data/*.csv')
for file in sorted(csv_files):
    if 'bak' in file: continue
    
    # Extract month from filename
    month_str = ''
    for m_jp, m_iso in months.items():
        if m_jp in file:
            month_str = m_iso
            break
            
    if not month_str: continue
    
    print(f"Processing {file} for {month_str}")
    
    items = []
    total_amount = 0
    summary = {}
    
    with open(file, 'r', encoding='shift_jis', errors='replace') as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i < 2: continue # skip header lines
            if len(row) < 21: continue
            
            ident = row[0].strip()
            cat_code = row[1].strip()
            mat_code = row[4].strip()
            name = row[6].strip()
            
            try:
                price = float(row[14].strip().replace(',', '')) if row[14].strip() else 0
            except:
                price = 0
                
            try:
                actualQty = float(row[18].strip().replace(',', '')) if row[18].strip() else 0
            except:
                actualQty = 0
                
            amount = price * actualQty
            total_amount += amount
            
            if cat_code not in summary:
                summary[cat_code] = {'categoryName': f'Category {cat_code}', 'amount': 0}
            summary[cat_code]['amount'] += amount
            
            items.append({
                'id': mat_code if mat_code else ident,
                'name': name,
                'category': cat_code,
                'actualQty': actualQty,
                'price': price,
                'actualAmount': amount,
                'diffQty': 0,
                'diffAmount': 0,
                'note': '',
                'type': 'inventory'
            })
            
    monthly_data.append({
        'month': month_str,
        'items': items,
        'summary': summary,
        'total': total_amount,
        'fixedTotal': 0,
        'closedAt': datetime.now().isoformat() + 'Z'
    })

with open('data/new_monthly.json', 'w', encoding='utf-8') as f:
    json.dump(monthly_data, f, ensure_ascii=False, indent=2)

print(f"Generated data/new_monthly.json with {len(monthly_data)} months of data.")
