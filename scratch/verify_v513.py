import re
import os
import csv

def test_version_and_cache_busters():
    print("Testing Version and Cache Busters...")
    
    # 1. Read index.html
    with open('index.html', 'r', encoding='utf-8') as f:
        idx_content = f.read()
        
    # Check version
    if 'v5.13' not in idx_content:
        return False, "v5.13 not found in index.html"
    if 'styles.css?v=20260520_13' not in idx_content:
        return False, "styles.css cache buster not updated in index.html"
    if 'data.js?v=20260520_13' not in idx_content:
        return False, "data.js cache buster not updated in index.html"
    if 'app.js?v=20260520_13' not in idx_content:
        return False, "app.js cache buster not updated in index.html"
        
    # 2. Read mobile_source.html
    with open('mobile_source.html', 'r', encoding='utf-8') as f:
        mob_src_content = f.read()
        
    if 'v5.13' not in mob_src_content:
        return False, "v5.13 not found in mobile_source.html"
    if 'styles-mobile.css?v=20260520_13' not in mob_src_content:
        return False, "styles-mobile.css cache buster not updated in mobile_source.html"
    if 'data.js?v=20260520_13' not in mob_src_content:
        return False, "data.js cache buster not updated in mobile_source.html"
    if 'app-mobile.js?v=20260520_13' not in mob_src_content:
        return False, "app-mobile.js cache buster not updated in mobile_source.html"
        
    # 3. Read mobile.html (compiled)
    with open('mobile.html', 'r', encoding='utf-8') as f:
        mob_content = f.read()
        
    if 'v5.13' not in mob_content:
        return False, "v5.13 not found in compiled mobile.html"
        
    # CSS overrides check
    if '/* Mobile Overrides injected by build script */' not in mob_content:
        return False, "Mobile overrides not found in mobile.html"
        
    return True, "All versions and cache busters are correct!"

def test_comment_removal():
    print("Testing Comment Removal...")
    keywords = ["工場長コメント", "managerComment", "directorComment", "manager-comment"]
    
    files_to_check = ['index.html', 'mobile_source.html', 'app.js', 'app-mobile.js', 'styles.css', 'styles-mobile.css']
    for filename in files_to_check:
        if not os.path.exists(filename):
            continue
        with open(filename, 'r', encoding='utf-8') as f:
            content = f.read()
        for kw in keywords:
            if kw in content:
                # Exclude comment templates or code patterns if any, but since we completely deleted them:
                # Wait, if there are comments in script *names* or *outputs*, is it okay?
                # But actual code should not have them.
                return False, f"Keyword '{kw}' still exists in {filename}"
                
    return True, "Factory director comments are completely removed from code."

def test_csv_updates():
    print("Testing CSV Updates...")
    file_path = "inventory_data/【2課】2026年1月棚卸表.csv"
    if not os.path.exists(file_path):
        return False, "January CSV file does not exist"
        
    with open(file_path, 'r', encoding='cp932') as f:
        reader = list(csv.reader(f))
        
    expected = {
        956: ("26-036", "26", "N26000000000036"),
        957: ("26-036", "26", "N26000000000036"),
        959: ("26-036", "26", "N26000000000036"),
        960: ("26-021", "26", "N26000000000021"),
        962: ("26-023", "26", "N26000000000023"),
        972: ("12-205", "12", "N12000000000205"),
        973: ("12-161", "12", "N12000000000161"),
        974: ("12-192", "12", "N12000000000192"),
        975: ("26-023", "26", "N26000000000023"),
        977: ("26-026", "26", "N26000000000026")
    }
    
    for row_num, (class_code, classification, code) in expected.items():
        row = reader[row_num - 1]
        if row[0] != class_code:
            return False, f"Row {row_num} ClassCode mismatch: expected {class_code}, got {row[0]}"
        if row[1] != classification:
            return False, f"Row {row_num} Classification mismatch: expected {classification}, got {row[1]}"
        if row[4] != code:
            return False, f"Row {row_num} Code mismatch: expected {code}, got {row[4]}"
            
    return True, "All CSV updates are verified successfully!"

def main():
    v_ok, v_msg = test_version_and_cache_busters()
    c_ok, c_msg = test_comment_removal()
    csv_ok, csv_msg = test_csv_updates()
    
    report = []
    report.append("# 検証報告書 (v5.13)")
    report.append(f"\n## 1. バージョン・キャッシュバスター検証")
    report.append(f"- index.html: {'[OK]' if v_ok else '[NG]'} {v_msg}")
    report.append(f"- mobile_source.html: {'[OK]' if v_ok else '[NG]'} {v_msg}")
    report.append(f"- mobile.html: {'[OK]' if v_ok else '[NG]'} {v_msg}")
    
    report.append(f"\n## 2. 工場長コメント機能の完全削除検証")
    report.append(f"- UI表示・コード検索結果: {'[OK]' if c_ok else '[NG]'} {c_msg}")
    
    report.append(f"\n## 3. 1月棚卸CSV資材コード修正検証")
    report.append(f"- 対象10レコードの転記確認: {'[OK]' if csv_ok else '[NG]'} {csv_msg}")
    
    overall = v_ok and c_ok and csv_ok
    report.append(f"\n## 総合判定")
    report.append(f"{'PASS' if overall else 'FAIL'}")
    
    report_text = "\n".join(report)
    print("\n" + report_text)
    
    with open("scratch/fukasawa_v513_verification_report.md", 'w', encoding='utf-8') as out:
        out.write(report_text)
        
    print("\nSaved verification report to scratch/fukasawa_v513_verification_report.md")

if __name__ == "__main__":
    main()
