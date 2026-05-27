import json

def check_dict(d, path=""):
    invalid_keys = []
    if isinstance(d, dict):
        for k, v in d.items():
            if not k or any(c in k for c in ["$", "#", "[", "]", ".", "/"]):
                invalid_keys.append(f"{path}[{k}]")
            invalid_keys.extend(check_dict(v, path + f"[{k}]"))
    elif isinstance(d, list):
        for i, v in enumerate(d):
            invalid_keys.extend(check_dict(v, path + f"[{i}]"))
    return invalid_keys

with open('data/new_monthly_1_to_5.json', 'r') as f:
    data = json.load(f)

bad = check_dict(data)
if bad:
    print("Found invalid keys:")
    for b in bad:
        print(b)
else:
    print("No invalid keys found in structure.")

