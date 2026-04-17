
import re

def main():
    # 1. HTML Cleanup
    with open('mobile_source.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Remove <div id="debug-log"...></div>
    html = re.sub(r' +<!-- Debug Log -->\n +<div id="debug-log".*?></div>\n', '', html)
    
    with open('mobile_source.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    # 2. JS Cleanup
    with open('app.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    new_lines = []
    skip = False
    
    for line in lines:
        # Remove logToDebug definition
        if "function logToDebug(msg) {" in line:
            skip = True
        
        if skip:
            if line.strip() == "}":
                skip = False
            continue
            
        # Remove calls to logToDebug
        if "logToDebug(" in line:
            continue
            
        new_lines.append(line)
        
    with open('app.js', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
        
    print("Cleanup complete")

if __name__ == "__main__":
    main()
