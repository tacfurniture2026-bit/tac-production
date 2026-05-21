import re

def main():
    with open("scratch/all_n_codes.txt", 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    targets = [
        ("PAO WORK BOX1人1012BL GO不燃", ["PAO", "1012", "BL", "GO"]),
        ("PAO CALMDOWN1290R GO", ["CALMDOWN"]),
        ("PAO WORK BOX1人1012SR GO不燃", ["PAO", "1012", "SR", "GO"]),
        ("PAO WORK BOX1人1012SL GO不燃", ["PAO", "1012", "SL", "GO"]),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1KKA", ["RGFJLNW", "1KKA"]),
        ("ｼｪﾙﾌ 中方立 H2400 D240用 BW", ["G1IV240", "BW"]),
        ("ｼｪﾙﾌ 左右方立 H2400 D240用 BW", ["G1HV240", "BW"]),
        ("ｼｪﾙﾌ 施工棚板W800 D240用3枚入 BW", ["G1E8003", "BW"]),
        ("ｼｪﾙﾌ 追加棚板 W800 D240用 BW", ["G1K8003", "BW"]),
        ("ｼｪﾙﾌ 可動棚板 W800 D240用 BW", ["G1S8003", "BW"]),
        ("ｼｪﾙﾌ 中方立 H2400 D380用", ["G1IV240", "AGO"]),
        ("ｼｪﾙﾌ 左右方立 H2400 D380", ["G1HV240", "AGO"]),
        ("ｼｪﾙﾌ 施工棚板W800 D380用3", ["G1E8003", "AGO"]),
        ("ｼｪﾙﾌ 追加棚板 W800 D380用", ["G1K8003", "AGO"]),
        ("ｼｪﾙﾌ 可動棚板 W800 D380用", ["G1S8003", "AGO"]),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1BW", ["RGFJLNW", "1BW"]),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1GO", ["RGFJLNW", "1GO"]),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1MPP", ["RGFJLNW", "1MPP"]),
        ("木製ﾛｯｶｰ Wﾊﾟｰﾂ1 RGFJLNW-1WH", ["RGFJLNW", "1WH"]),
        ("特注/PAO(1人用)9100002362", ["9100002362"]),
        ("特注/PAO(4人用)9100002363", ["9100002363"]),
        ("特注/PAO(6人用)9100002364", ["9100002364"])
    ]
    
    out_lines = []
    
    # Let's also do a general search for any G1... codes in all_n_codes
    out_lines.append("=== GENERAL G1... CODES IN MASTER ===")
    for line in lines:
        if "G1" in line:
            out_lines.append(line.strip())
            
    out_lines.append("\n=== GENERAL RGFJLNW CODES IN MASTER ===")
    for line in lines:
        if "RGFJLNW" in line:
            out_lines.append(line.strip())
            
    out_lines.append("\n=== GENERAL CALMDOWN CODES IN MASTER ===")
    for line in lines:
        if "CALMDOWN" in line:
            out_lines.append(line.strip())

    out_lines.append("\n=== DETAILED TARGET MATCHES ===")
    for name, keywords in targets:
        out_lines.append(f"\nTarget: {name} (keywords: {keywords})")
        found = False
        for line in lines:
            if all(kw.lower() in line.lower() for kw in keywords):
                out_lines.append(f"  Match: {line.strip()}")
                found = True
        if not found:
            # Try fuzzy: match color and basic pattern
            out_lines.append("  No direct match found. Broadening search...")
            broad_keywords = [keywords[0]] if keywords else []
            if broad_keywords:
                matches = []
                for line in lines:
                    if all(kw.lower() in line.lower() for kw in broad_keywords):
                        matches.append(line.strip())
                out_lines.append(f"  Fuzzy matches (using {broad_keywords}):")
                for m in matches[:10]:
                    out_lines.append(f"    - {m}")
                    
    with open("scratch/n_code_search_results.txt", 'w', encoding='utf-8') as out:
        out.write("\n".join(out_lines))
        
    print("Search results written to scratch/n_code_search_results.txt")

if __name__ == "__main__":
    main()
