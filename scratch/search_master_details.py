import json

def main():
    with open("scratch/fb_inv_products.json", 'r', encoding='utf-8') as f:
        products = json.load(f)
        
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

    # 1. Search for all real (starts with N) products matching keywords
    keywords = ["RGFJLNW", "PAO", "G1IV", "G1HV", "G1E800", "G1K800", "G1S800", "CALMDOWN"]
    
    print("=== N-Code Matches in Firebase Master ===")
    for kw in keywords:
        print(f"\n--- Keyword: {kw} ---")
        matches = []
        for p in flat_products:
            pid = p.get('id', '')
            pname = p.get('name', '')
            if pid.startswith('N') and (kw.lower() in pname.lower() or kw.lower() in pid.lower()):
                matches.append(p)
        for m in sorted(matches, key=lambda x: x.get('id')):
            print(f"ID: '{m.get('id')}' | Name: '{m.get('name')}'")

if __name__ == "__main__":
    main()
