import csv
import json
import os
import glob
from datetime import datetime

MAY_CSV = 'inventory_data/【2課】2026年5月棚卸表.csv'
EXISTING_MONTHLY_JSON = 'data/new_monthly.json'
OUT_MASTER = 'data/new_master_may.json'
OUT_MONTHLY = 'data/new_monthly_1_to_5.json'
MONTH_STR = '2026-05'

def is_fixed(row):
    # P列 (インデックス15) が「対象(不動品)」または「対象（不動品）」
    # I列 (インデックス8) に「ｲﾋﾞｹﾝ」が含まれる
    col_p = row[15].strip() if len(row) > 15 else ""
    col_i = row[8].strip() if len(row) > 8 else ""
    
    if "対象(不動品)" in col_p or "対象（不動品）" in col_p:
        return True
    
    # 全角・半角の違いやスペースを無視してチェック
    col_i_norm = col_i.replace(" ", "").replace("　", "").replace("ｲﾋﾞｹﾝ", "イビケン")
    if "イビケン" in col_i_norm or "ｲﾋﾞｹﾝ" in col_i:
        return True
        
    return False

def process():
    if not os.path.exists(MAY_CSV):
        print(f"Error: {MAY_CSV} not found.")
        return

    # Load existing monthly data
    monthly_data = []
    if os.path.exists(EXISTING_MONTHLY_JSON):
        with open(EXISTING_MONTHLY_JSON, 'r', encoding='utf-8') as f:
            try:
                monthly_data = json.load(f)
                # Remove any existing 2026-05 to avoid duplication
                monthly_data = [m for m in monthly_data if m.get('month') != MONTH_STR]
            except:
                pass

    master_list = []
    items = []
    total_amount = 0
    summary = {}
    
    with open(MAY_CSV, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.reader(f)
        for i, row in enumerate(reader):
            if i < 2: continue # skip header
            if len(row) < 21: continue
            
            ident = row[0].strip()
            cat_code = row[1].strip()
            mat_code = row[4].strip()
            name = row[6].strip()
            
            # Skip empty lines
            if not ident and not mat_code:
                continue
                
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
            
            # Check dead stock flag
            fixed_flag = is_fixed(row)
            
            # 主キーの決定（基本は資材コード、なければ識別コード）
            primary_id = mat_code if mat_code else ident
            
            # For Master
            master_list.append({
                'id': primary_id,
                'identCode': ident,
                'name': name,
                'category': cat_code,
                'price': price,
                'isFixed': fixed_flag
            })
            
            # For Monthly summary aggregation
            if cat_code not in summary:
                summary[cat_code] = {'categoryName': f'Category {cat_code}', 'amount': 0}
            summary[cat_code]['amount'] += amount
            
            # For Monthly items
            items.append({
                'id': primary_id,
                'name': name,
                'category': cat_code,
                'actualQty': actualQty,
                'price': price,
                'actualAmount': amount,
                'diffQty': 0,
                'diffAmount': 0,
                'note': '',
                'type': 'inventory',
                'isFixed': fixed_flag
            })
            
    # Add May data
    monthly_data.append({
        'month': MONTH_STR,
        'items': items,
        'summary': summary,
        'total': total_amount,
        'fixedTotal': 0, # Calculate later
        'closedAt': datetime.now().isoformat() + 'Z'
    })
    
    # Calculate fixed total in summary logic if needed
    fixed_total = sum(it['actualAmount'] for it in items if it.get('isFixed'))
    monthly_data[-1]['fixedTotal'] = fixed_total

    # Write Master
    with open(OUT_MASTER, 'w', encoding='utf-8') as f:
        json.dump(master_list, f, ensure_ascii=False, indent=2)
        
    # Write Monthly
    with open(OUT_MONTHLY, 'w', encoding='utf-8') as f:
        json.dump(monthly_data, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Generated {OUT_MASTER} with {len(master_list)} products.")
    print(f"✅ Generated {OUT_MONTHLY} with {len(monthly_data)} months of data (Includes {MONTH_STR}).")
    print(f"✅ Found {sum(1 for p in master_list if p['isFixed'])} fixed (dead stock) items.")

if __name__ == '__main__':
    process()
