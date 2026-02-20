
def main():
    with open('app.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Target:
    #           const safeSet = (id, val) => {
    #              const el = document.getElementById(id);
    #              if (el) el.value = val;
    #           };
    #           safeSet('qr-project-name', projectName || '');
    
    # We want to insert safeSet('qr-raw-data', decodedText); before qr-project-name
    
    for i, line in enumerate(lines):
        if "safeSet('qr-project-name'" in line:
            # Insert before this line
            lines.insert(i, "          safeSet('qr-raw-data', decodedText);\n")
            break
            
    with open('app.js', 'w', encoding='utf-8') as f:
        f.writelines(lines)
    
    print("Successfully updated app.js with raw data logic")

if __name__ == "__main__":
    main()
