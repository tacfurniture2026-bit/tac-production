import csv
import json
import os
import glob
from datetime import datetime

MONTHS = {
    '1月': ('2026-01', '2026-01-31T23:59:59Z'),
    '2月': ('2026-02', '2026-02-28T23:59:59Z'),
    '3月': ('2026-03', '2026-03-31T23:59:59Z'),
    '4月': ('2026-04', '2026-04-30T23:59:59Z'),
    '5月': ('2026-05', '2026-05-31T23:59:59Z')
}

OUT_MASTER = 'data/new_master_may.json'
OUT_MONTHLY = 'data/new_monthly_1_to_5.json'
OUT_LOGS = 'data/new_logs_all.json'

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

def parseFloatSafely(val):
    if not val: return 0
    val = val.replace(',', '').replace('¥', '').replace(' ', '').replace('　', '')
    try:
        return float(val)
    except:
        return 0

def process():
    monthly_data = []
    logs = []
    master_dict = {}
    
    csv_files = glob.glob('inventory_data/*.csv')
    csv_files = sorted(csv_files)
    
    log_id_counter = 1
    
    for file in csv_files:
        if 'bak' in file: continue
        
        month_str = ''
        timestamp_str = ''
        for m_jp, (m_iso, t_iso) in MONTHS.items():
            if m_jp in file:
                month_str = m_iso
                timestamp_str = t_iso
                break
                
        if not month_str: continue
        
        print(f"Processing {file} for {month_str}")
        
        items = []
        total_amount = 0
        summary = {}
        
        # 5月期だけShift-JISではなくUTF-8の場合があるので判定
        encodings = ['utf-8', 'shift_jis']
        lines = []
        for enc in encodings:
            try:
                with open(file, 'r', encoding=enc, errors='replace') as f:
                    lines = list(csv.reader(f))
                break
            except Exception as e:
                pass
                
        for i, row in enumerate(lines):
            if i < 2: continue # skip header
            if len(row) < 19: continue
            
            ident = row[0].strip()
            cat_code = row[1].strip()
            if not cat_code: cat_code = "NONE"
                
            mat_code = row[4].strip()
            name = row[6].strip()
            
            if not ident and not mat_code: continue
            
            # Index 13: 単価
            price = parseFloatSafely(row[13]) if len(row) > 13 else 0
            # Index 18: 数量
            actualQty = parseFloatSafely(row[18]) if len(row) > 18 else 0
            # Index 20: 合計金額(1%増し)
            actualAmount = parseFloatSafely(row[20]) if len(row) > 20 else 0
            
            # フォールバック
            if actualAmount == 0 and price > 0 and actualQty > 0:
                actualAmount = price * actualQty * 1.01 # 1%増し
                
            total_amount += actualAmount
            fixed_flag = is_fixed(row)
            
            primary_id = mat_code if mat_code else ident
            
            # Master dict (5月分が最新になるように上書き)
            master_dict[primary_id] = {
                'id': primary_id,
                'identCode': ident,
                'name': name,
                'category': cat_code,
                'price': price,
                'isFixed': fixed_flag
            }
            
            if cat_code not in summary:
                summary[cat_code] = {'categoryName': f'Category {cat_code}', 'amount': 0}
            summary[cat_code]['amount'] += actualAmount
            
            items.append({
                'id': primary_id,
                'name': name,
                'category': cat_code,
                'actualQty': actualQty,
                'price': price,
                'actualAmount': actualAmount,
                'diffQty': 0,
                'diffAmount': 0,
                'note': '',
                'type': 'inventory',
                'isFixed': fixed_flag
            })
            
            # Generate logs if there is inventory
            if actualQty > 0 or i > 0:  # create log for all items in the CSV to reset count to 0 if actualQty=0
                logs.append({
                    'id': log_id_counter,
                    'productId': primary_id,
                    'type': 'count',
                    'quantity': actualQty,
                    'timestamp': timestamp_str,
                    'note': f'{month_str}期末棚卸',
                    'userId': 1,
                    'unitPrice': price,
                    'amountWithTax': actualAmount,
                    'productName': name
                })
                log_id_counter += 1
                
        fixed_total = sum(it['actualAmount'] for it in items if it.get('isFixed'))
        
        monthly_data.append({
            'month': month_str,
            'items': items,
            'summary': summary,
            'total': total_amount,
            'fixedTotal': fixed_total,
            'closedAt': timestamp_str
        })
        print(f"  -> Total Amount for {month_str}: {total_amount:,.2f}")

    # Output files
    master_list = list(master_dict.values())
    
    with open(OUT_MASTER, 'w', encoding='utf-8') as f:
        json.dump(master_list, f, ensure_ascii=False, indent=2)
        
    with open(OUT_MONTHLY, 'w', encoding='utf-8') as f:
        json.dump(monthly_data, f, ensure_ascii=False, indent=2)
        
    with open(OUT_LOGS, 'w', encoding='utf-8') as f:
        json.dump(logs, f, ensure_ascii=False, indent=2)
        
    print(f"✅ Generated {OUT_MASTER} with {len(master_list)} products.")
    print(f"✅ Generated {OUT_MONTHLY} with {len(monthly_data)} months.")
    print(f"✅ Generated {OUT_LOGS} with {len(logs)} logs.")

if __name__ == '__main__':
    process()
