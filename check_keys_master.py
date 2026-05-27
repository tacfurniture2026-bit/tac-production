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

with open('data/new_master_may.json', 'r') as f:
    bad = check_dict(json.load(f))
if bad:
    for b in bad: print(b)
else:
    print("Master JSON OK")
