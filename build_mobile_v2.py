
import os
import re

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def main():
    base_html = read_file('mobile_source.html')
    css_content = read_file('styles.css') # Use main styles.css (latest)
    app_js_content = read_file('app.js') # Use main app.js (latest)
    data_js_content = read_file('data.js')
    firebase_config_content = read_file('firebase-config.js')
    
    # Inject CSS (Regex to match any version strings)
    html = re.sub(r'<link rel="stylesheet" href="styles-mobile\.css[^>]*>', lambda m: f'<style>\n{css_content}\n</style>', base_html)
    
    # Inject Firebase Config
    html = re.sub(r'<script src="firebase-config\.js[^>]*></script>', lambda m: f'<script>\n{firebase_config_content}\n</script>', html)

    # Inject Data JS
    html = re.sub(r'<script src="data\.js[^>]*></script>', lambda m: f'<script>\n{data_js_content}\n</script>', html)

    # Inject App JS (Handle app-mobile.js or app.js ref)
    html = re.sub(r'<script src="app-mobile\.js[^>]*></script>', lambda m: f'<script>\n{app_js_content}\n</script>', html)
    
    # Remove version banner if present in base
    
    # Add Visual Indicator of V4 (Inline)
    # Removing red banner as user requested "mobile" fixed. 
    # But adding a small console log or meta tag could be useful.
    # User said "Address -3 no, mobile fixed". They likely want it to look normal.
    # I will hiding the red banner logic from previous V2.
    
    # Ensure specific mobile styling overrides are present since we used main styles.css
    mobile_overrides = """
    /* Mobile Overrides injected by build script */
    #version-banner { display: none !important; }
    .theme-switch-wrapper { position: fixed !important; top: 10px !important; left: 10px !important; bottom: auto !important; z-index: 99999 !important; }
    """
    html = html.replace('</style>', f'{mobile_overrides}\n</style>')

    with open('mobile.html', 'w', encoding='utf-8') as f: # Overwrite mobile.html directly
        f.write(html)
    
    print("Successfully created mobile.html with ALL assets inlined.")

if __name__ == "__main__":
    main()
