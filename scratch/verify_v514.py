import os

def test_version_and_cache_busters():
    print("Testing Version and Cache Busters for v5.14...")
    
    # 1. Read index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        idx_content = f.read()
        
    # Check version
    if 'v5.14' not in idx_content:
        return False, "v5.14 not found in index.html"
    if 'styles.css?v=20260520_14' not in idx_content:
        return False, "styles.css cache buster not updated in index.html"
    if 'data.js?v=20260520_14' not in idx_content:
        return False, "data.js cache buster not updated in index.html"
    if 'app.js?v=20260520_14' not in idx_content:
        return False, "app.js cache buster not updated in index.html"
        
    # 2. Read mobile_source.html
    with open('mobile_source.html', 'r', encoding='utf-8') as f:
        mob_src_content = f.read()
        
    if 'v5.14' not in mob_src_content:
        return False, "v5.14 not found in mobile_source.html"
    if 'styles-mobile.css?v=20260520_14' not in mob_src_content:
        return False, "styles-mobile.css cache buster not updated in mobile_source.html"
    if 'data.js?v=20260520_14' not in mob_src_content:
        return False, "data.js cache buster not updated in mobile_source.html"
    if 'app-mobile.js?v=20260520_14' not in mob_src_content:
        return False, "app-mobile.js cache buster not updated in mobile_source.html"
        
    # 3. Read mobile.html (compiled)
    with open('mobile.html', 'r', encoding='utf-8') as f:
        mob_content = f.read()
        
    if 'v5.14' not in mob_content:
        return False, "v5.14 not found in compiled mobile.html"
        
    # CSS overrides check
    if '/* Mobile Overrides injected by build script */' not in mob_content:
        return False, "Mobile overrides not found in mobile.html"
        
    return True, "All versions and cache busters are correct!"

def test_temp_filtering():
    print("Testing TEMP_ filtering logic in app.js and app-mobile.js...")
    
    with open('app.js', 'r', encoding='utf-8') as f:
        app_content = f.read()
        
    # Check startsWith('TEMP_') in app.js
    if "startsWith('TEMP_')" not in app_content:
        return False, "TEMP_ filtering logic not found in app.js"
        
    # Count occurrences (should be at least 4 in our changes + other existing ones)
    count_app = app_content.count("startsWith('TEMP_')")
    if count_app < 4:
        return False, f"TEMP_ filtering logic count in app.js is too low ({count_app})"
        
    with open('app-mobile.js', 'r', encoding='utf-8') as f:
        app_mob_content = f.read()
        
    # Check startsWith('TEMP_') in app-mobile.js
    if "startsWith('TEMP_')" not in app_mob_content:
        return False, "TEMP_ filtering logic not found in app-mobile.js"
        
    count_mob = app_mob_content.count("startsWith('TEMP_')")
    if count_mob < 4:
        return False, f"TEMP_ filtering logic count in app-mobile.js is too low ({count_mob})"
        
    return True, "TEMP_ filtering logic verified in app.js and app-mobile.js!"

def main():
    v_ok, v_msg = test_version_and_cache_busters()
    t_ok, t_msg = test_temp_filtering()
    
    report = []
    report.append("# 検証報告書 (v5.14)")
    report.append(f"\n## 1. バージョン・キャッシュバスター検証")
    report.append(f"- index.html: {'[OK]' if v_ok else '[NG]'} {v_msg}")
    report.append(f"- mobile_source.html: {'[OK]' if v_ok else '[NG]'} {v_msg}")
    report.append(f"- mobile.html: {'[OK]' if v_ok else '[NG]'} {v_msg}")
    
    report.append(f"\n## 2. 資材CD異常(TEMP_)フィルタリング検証")
    report.append(f"- app.js / app-mobile.js 内の除外ロジック: {'[OK]' if t_ok else '[NG]'} {t_msg}")
    
    overall = v_ok and t_ok
    report.append(f"\n## 総合判定")
    report.append(f"{'PASS' if overall else 'FAIL'}")
    
    report_text = "\n".join(report)
    print("\n" + report_text)
    
    with open("scratch/fukasawa_v514_verification_report.md", 'w', encoding='utf-8') as out:
        out.write(report_text)
        
    print("\nSaved verification report to scratch/fukasawa_v514_verification_report.md")

if __name__ == "__main__":
    main()
