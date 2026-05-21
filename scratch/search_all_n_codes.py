import json
import re

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

    n_codes = []
    for p in flat_products:
        pid = p.get('id', '')
        pname = p.get('name', '')
        pcategory = p.get('category', '')
        if pid.startswith('N'):
            n_codes.append((pid, pname, pcategory))
            
    # Sort by ID
    n_codes.sort()
    
    print(f"Total N-codes in Master: {len(n_codes)}")
    
    # Save to a file for complete analysis
    with open("scratch/all_n_codes.txt", 'w', encoding='utf-8') as out:
        for pid, pname, pcat in n_codes:
            out.write(f"ID: {pid} | Category: {pcat} | Name: {pname}\n")
            
    print("Saved all N-codes to scratch/all_n_codes.txt")

if __name__ == "__main__":
    main()
