
import re

def main():
    # 1. HTML Cleanup
    with open('mobile_source.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Remove <div id="debug-log"...></div>
    # My regex was strict on spaces. Let's make it flexible.
    # Pattern: <div id="debug-log" ... ></div>
    html = re.sub(r'<div id="debug-log"[^>]*></div>', '', html)
    # Also clean up empty lines if created?
    
    with open('mobile_source.html', 'w', encoding='utf-8') as f:
        f.write(html)
        
    # 2. JS Cleanup
    with open('app.js', 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    # Find function logToDebug
    start_idx = -1
    for i, line in enumerate(lines):
        if "function logToDebug(msg) {" in line:
            start_idx = i
            break
            
    if start_idx != -1:
        # Find end
        brace_count = 0
        found_start = False
        end_idx = -1
        for i in range(start_idx, len(lines)):
            line = lines[i]
            brace_count += line.count('{')
            brace_count -= line.count('}')
            if brace_count > 0: found_start = True
            if found_start and brace_count == 0:
                end_idx = i + 1
                break
        
        if end_idx != -1:
            # Remove lines[start_idx:end_idx]
            # We can mark them as None or empty string to filter later
            for k in range(start_idx, end_idx):
                lines[k] = ""
                
    # Remove calls to logToDebug
    final_lines = []
    for line in lines:
        if line == "": continue # Removed function lines
        if "logToDebug(" in line: continue # Removed calls
        final_lines.append(line)
        
    with open('app.js', 'w', encoding='utf-8') as f:
        f.writelines(final_lines)
        
    print("Robust cleanup complete")

if __name__ == "__main__":
    main()
