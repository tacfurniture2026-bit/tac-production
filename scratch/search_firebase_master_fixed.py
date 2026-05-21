import json

def main():
    fb_path = "scratch/fb_inv_products.json"
    
    with open(fb_path, 'r', encoding='utf-8') as f:
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
                
    model_codes = [
        "G1IV240BBW1-N",
        "G1HV240BBW2-N",
        "G1E8003BBW3-N",
        "G1K8003BBW1-N",
        "G1S8003BBW1-N",
        "G1IV240AGO1",
        "G1HV240AGO2",
        "G1E8003AGO3",
        "G1K8003AGO1",
        "G1S8003AGO1",
        "RGFJLNW-1BW",
        "RGFJLNW-1GO",
        "RGFJLNW-1MPP",
        "RGFJLNW-1KKA",
        "RGFJLNW-1WH",
        "9100002362",
        "9100002363",
        "9100002364",
        "CALMDOWN1290R",
        "1012SR GO",
        "1012SL GO",
        "1012BL GO"
    ]
    
    print("=== SEARCHING FIREBASE MASTER BY MODEL CODES ===")
    for target in model_codes:
        print(f"\nTarget: {target}")
        found = False
        for p in flat_products:
            pid = p.get('id', '')
            pname = p.get('name', '')
            if pid.startswith('N') and (target.lower() in pid.lower() or target.lower() in pname.lower()):
                print(f"  Match: ID: '{pid}' | Name: '{pname}'")
                found = True
        if not found:
            # Try fuzzy: search for similar codes
            # e.g. for G1IV240BBW1-N, search for G1IV
            prefix = ""
            if "G1IV" in target: prefix = "G1IV"
            elif "G1HV" in target: prefix = "G1HV"
            elif "G1E" in target: prefix = "G1E"
            elif "G1K" in target: prefix = "G1K"
            elif "G1S" in target: prefix = "G1S"
            elif "RGFJLNW" in target: prefix = "RGFJLNW"
            
            if prefix:
                fuzzy_matches = []
                for p in flat_products:
                    pid = p.get('id', '')
                    pname = p.get('name', '')
                    if pid.startswith('N') and (prefix.lower() in pid.lower() or prefix.lower() in pname.lower()):
                        fuzzy_matches.append(p)
                if fuzzy_matches:
                    print(f"  Fuzzy matches (prefix {prefix}):")
                    for m in fuzzy_matches[:5]:
                        print(f"    - ID: '{m.get('id')}' | Name: '{m.get('name')}'")
                else:
                    print("  No matches found.")
            else:
                print("  No matches found.")

if __name__ == "__main__":
    main()
