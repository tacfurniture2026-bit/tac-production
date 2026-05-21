import urllib.request
import json
import sys

def main():
    url = "https://tac-production-bfd08-default-rtdb.asia-southeast1.firebasedatabase.app/.json"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                body = response.read().decode('utf-8')
                data = json.loads(body)
                print("Successfully fetched Firebase data")
                
                # Print the keys at top level
                print("Top level keys:", list(data.keys()) if data else "Empty")
                
                # Inspect inv_products
                inv_products = data.get('inv_products', [])
                print(f"Number of inv_products: {len(inv_products)}")
                
                # Print any product that has id starting with TEMP_ or name/worker containing TEMP_ or similar
                temp_products = []
                for p in inv_products:
                    if p and isinstance(p, dict):
                        pid = p.get('id', '')
                        pname = p.get('name', '')
                        if 'TEMP_' in str(pid) or 'TEMP_' in str(pname):
                            temp_products.append(p)
                
                print(f"Products with 'TEMP_': {len(temp_products)}")
                for p in temp_products:
                    print(p)
                    
                # If we didn't find them in inv_products, search globally in all tables
                print("\nSearching globally for 'TEMP_'...")
                find_temp_global(data)
                
            else:
                print(f"Failed to fetch data, status: {response.status}")
    except Exception as e:
        print("Error:", e)

def find_temp_global(obj, path=""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            new_path = f"{path}.{k}" if path else k
            if 'TEMP_' in str(k):
                print(f"Key match: {new_path} = {v}")
            find_temp_global(v, new_path)
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            new_path = f"{path}[{idx}]"
            if 'TEMP_' in str(item):
                print(f"List item match: {new_path} = {item}")
            find_temp_global(item, new_path)
    else:
        if 'TEMP_' in str(obj):
            print(f"Value match: {path} = {obj}")

if __name__ == "__main__":
    main()
