import json
import re

def main():
    fb_path = "scratch/fb_inv_products.json"
    
    with open(fb_path, 'r', encoding='utf-8') as f:
        products = json.load(f)
        
    print(f"Loaded {len(products)} products from Firebase Master.")
    
    missing_targets = [
        ("PAO WORK BOX1人1012BL GO不燃", ""),
        ("PAO CALMDOWN1290R GO", ""),
        ("PAO WORK BOX1人1012SR GO不燃", ""),
        ("PAO WORK BOX1人1012SL GO不燃", ""),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA", "RGFJLNW-1KKA"),
        ("ｼｪﾙﾌ 中方立 H2400 D240用 BW", "G1IV240BBW1-N"),
        ("ｼｪﾙﾌ 左右方立 H2400 D240用 BW", "G1HV240BBW2-N"),
        ("ｼｪﾙﾌ 施工棚板W800 D240用3枚入 BW", "G1E8003BBW3-N"),
        ("ｼｪﾙﾌ 追加棚板 W800 D240用 BW", "G1K8003BBW1-N"),
        ("ｼｪﾙﾌ 可動棚板 W800 D240用 BW", "G1S8003BBW1-N"),
        ("ｼｪﾙﾌ 中方立 H2400 D380用", "G1IV240AGO1"),
        ("ｼｪﾙﾌ 左右方立 H2400 D380", "G1HV240AGO2"),
        ("ｼｪﾙﾌ 施工棚板W800 D380用3", "G1E8003AGO3"),
        ("ｼｪﾙﾌ 追加棚板 W800 D380用", "G1K8003AGO1"),
        ("ｼｪﾙﾌ 可動棚板 W800 D380用", "G1S8003AGO1"),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1BW", "RGFJLNW-1BW"),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1GO", "RGFJLNW-1GO"),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1MPP", "RGFJLNW-1MPP"),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1WH", "RGFJLNW-1WH"),
        ("特注/PAO(1人用)9100002362", ""),
        ("特注/PAO(4人用)9100002363", ""),
        ("特注/PAO(6人用)9100002364", "")
    ]
    
    # We will search fb_inv_products for matches.
    # Note that products in Realtime DB can be a list or dict.
    # We will convert it to a flat list of dicts.
    flat_products = []
    if isinstance(products, dict):
        for k, v in products.items():
            if isinstance(v, dict):
                v['fb_key'] = k
                flat_products.append(v)
    elif isinstance(products, list):
        for idx, item in enumerate(products):
            if item and isinstance(item, dict):
                item['fb_idx'] = idx
                flat_products.append(item)
                
    results = {}
    
    for name, remark in missing_targets:
        print(f"\n==========================================")
        print(f"Target: Name='{name}' | Remark='{remark}'")
        print(f"==========================================")
        
        found = False
        
        # 1. Match by exact name or exact ID (if we search by name)
        for p in flat_products:
            pname = p.get('name', '').strip()
            pid = p.get('id', '').strip()
            pcategory = p.get('category', '').strip()
            
            # Check if name matches
            if pname == name:
                print(f"  [Exact Name Match] ID: '{pid}' | Name: '{pname}' | Category: '{pcategory}'")
                found = True
                
        # 2. Match by remark/model code in product name or properties
        if remark:
            for p in flat_products:
                pname = p.get('name', '').strip()
                pid = p.get('id', '').strip()
                pcategory = p.get('category', '').strip()
                if remark.lower() in pname.lower() or remark.lower() in pid.lower():
                    print(f"  [Remark Match in Name/ID] ID: '{pid}' | Name: '{pname}' | Category: '{pcategory}'")
                    found = True
                    
        # 3. Fuzzy search if not found
        if not found:
            # Look for sub-parts of name
            sub_parts = []
            if "ｼｪﾙﾌ" in name:
                # e.g., "中方立", "D240", "BW"
                for t in ["中方立", "左右方立", "施工棚", "追加棚", "可動棚"]:
                    if t in name: sub_parts.append(t)
                for d in ["D240", "D380"]:
                    if d in name: sub_parts.append(d)
                for c in ["BW", "GO", "SH", "WH", "LO"]:
                    if c in name: sub_parts.append(c)
            elif "木製ﾛｯｶｰ" in name:
                sub_parts.append("木製")
                for c in ["BW", "GO", "KKA", "WH", "MPP"]:
                    if c in name: sub_parts.append(c)
            elif "PAO" in name:
                sub_parts.append("PAO")
                for c in ["BL", "BR", "SL", "SR", "WH", "GO"]:
                    if c in name: sub_parts.append(c)
                for d in ["1012", "1290", "1618", "1218"]:
                    if d in name: sub_parts.append(d)
            
            if sub_parts:
                print(f"  [Fuzzy Search Terms: {sub_parts}]")
                matches = []
                for p in flat_products:
                    pname = p.get('name', '').strip()
                    pid = p.get('id', '').strip()
                    pcategory = p.get('category', '').strip()
                    if all(part.lower() in pname.lower() or part.lower() in pid.lower() for part in sub_parts):
                        matches.append(p)
                for m in matches[:5]:
                    print(f"    -> ID: '{m.get('id')}' | Name: '{m.get('name')}' | Category: '{m.get('category')}'")

if __name__ == "__main__":
    main()
