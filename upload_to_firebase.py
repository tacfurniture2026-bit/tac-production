import json
import urllib.request
import urllib.error

# Firebase URL
FIREBASE_URL = "https://tac-production-bfd08-default-rtdb.asia-southeast1.firebasedatabase.app/INV_PRODUCTS.json"

# Load new master data
try:
    with open('data/new_master.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception as e:
    print(f"Error loading JSON: {e}")
    exit(1)

# Upload via REST API (PUT overwrites the node)
req = urllib.request.Request(FIREBASE_URL, method='PUT')
req.add_header('Content-Type', 'application/json')
json_data = json.dumps(data).encode('utf-8')

try:
    with urllib.request.urlopen(req, data=json_data) as response:
        if response.status == 200:
            print("Successfully uploaded to Firebase!")
        else:
            print(f"Failed with status: {response.status}")
            print(response.read().decode('utf-8'))
except urllib.error.URLError as e:
    print(f"URLError: {e}")
