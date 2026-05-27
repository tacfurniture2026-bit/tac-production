import csv
import json
import os
import glob

MONTHS = {
    '1月': ('2026-01', '2026-01-31T23:59:59Z'),
    '2月': ('2026-02', '2026-02-28T23:59:59Z'),
    '3月': ('2026-03', '2026-03-31T23:59:59Z'),
    '4月': ('2026-04', '2026-04-30T23:59:59Z'),
    '5月': ('2026-05', '2026-05-31T23:59:59Z')
}

INV_CATEGORIES = {
  '01': '基材', '02': '面材', '03': 'シート', '04': '木口ﾃｰﾌﾟ',
  '05': '金具', '06': 'ﾀﾞﾝﾎﾞｰﾙ', '07': '接着剤', '08': '仕入備品',
  '09': 'PAO資材', '10': '工場部材', '11': '仕掛品芯組のみ',
  '12': '仕掛品カット', '13': '部材完成品', '14': '製品在庫',
  '15': 'シェルフ製品在庫', '16': 'キャビネット製品在庫',
  '17': 'ラミテック', '18': '天野木工', '19': 'いろは',
  '20': 'Real', '21': 'イイダアックス', '22': '下請け預かり品',
  '23': 'GRID不動品', '24': '仕掛品フラッシュのみ',
  '25': '仕掛品縁貼り', '26': '仕掛品ボーリング', '99': 'その他'
}

OUT_MASTER = 'data/new_master_may.json'
OUT_MONTHLY = 'data/new_monthly_1_to_5.json'
OUT_LOGS = 'data/new_logs_all.json'

def is_fixed(row):
    col_p = row[15].strip() if len(row) > 15 else ""
    col_i = row[8].strip() if len(row) > 8 else ""
    if "対象(不動品)" in col_p or "対象（不動品）" in col_p:
        return True
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
    
    # 履歴を保持する辞書: { productId: { 'qty': 0, 'amount': 0 } }
    prev_stock = {}
    
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
        prev_total = 0
        summary = {}
        
        # エンコーディング対応 (cp932 -> utf-8-sig の順)
        encodings = ['cp932', 'utf-8-sig', 'shift_jis']
        lines = []
        for enc in encodings:
            try:
                # errors='strict' にして、デコードできない場合は例外を発生させる
                with open(file, 'r', encoding=enc, errors='strict') as f:
                    lines = list(csv.reader(f))
                print(f"  -> Successfully read with {enc}")
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
            
            price = parseFloatSafely(row[13]) if len(row) > 13 else 0
            currQty = parseFloatSafely(row[18]) if len(row) > 18 else 0
            amount = parseFloatSafely(row[20]) if len(row) > 20 else 0
            
            if amount == 0 and price > 0 and currQty > 0:
                amount = price * currQty * 1.01
                
            total_amount += amount
            fixed_flag = is_fixed(row)
            
            primary_id = mat_code if mat_code else ident
            
            # 前月在庫の取得
            p_stock = prev_stock.get(primary_id, {'qty': 0, 'amount': 0})
            prevQty = p_stock['qty']
            prevAmount = p_stock['amount']
            diff = currQty - prevQty
            prev_total += prevAmount
            
            master_dict[primary_id] = {
                'id': primary_id,
                'identCode': ident,
                'name': name,
                'category': cat_code,
                'price': price,
                'isFixed': fixed_flag
            }
            
            catKey = 'fixed' if fixed_flag else cat_code
            if catKey not in summary:
                catName = '不動品' if fixed_flag else INV_CATEGORIES.get(cat_code, f'分類{cat_code}')
                summary[catKey] = {'name': catName, 'amount': 0, 'diff': 0, 'prevAmount': 0}
            summary[catKey]['amount'] += amount
            summary[catKey]['prevAmount'] += prevAmount
            
            # アプリ(calculateInvMonthly)が期待するキー名を使用する
            items.append({
                'productId': primary_id,
                'name': name,
                'category': cat_code,
                'price': price,
                'prevQty': prevQty,
                'currQty': currQty,
                'diff': diff,
                'amount': amount,
                'prevAmount': prevAmount,
                'isFixed': fixed_flag
            })
            
            if currQty > 0 or i > 0:
                logs.append({
                    'id': log_id_counter,
                    'productId': primary_id,
                    'type': 'count',
                    'quantity': currQty,
                    'timestamp': timestamp_str,
                    'note': f'{month_str}期末棚卸',
                    'userId': 1,
                    'unitPrice': price,
                    'amountWithTax': amount,
                    'productName': name
                })
                log_id_counter += 1
                
            # 次の月のための前月在庫の更新
            prev_stock[primary_id] = {'qty': currQty, 'amount': amount}
                
        # summary の diff を計算
        for k in summary:
            summary[k]['diff'] = summary[k]['amount'] - summary[k]['prevAmount']
                
        fixed_total = sum(it['amount'] for it in items if it.get('isFixed'))
        
        monthly_data.append({
            'month': month_str,
            'items': items,
            'summary': summary,
            'total': total_amount,
            'prevTotal': prev_total,
            'fixedTotal': fixed_total,
            'closedAt': timestamp_str
        })
        print(f"  -> Total Amount for {month_str}: {total_amount:,.2f}")

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
