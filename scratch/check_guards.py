import os
import re

apps_dir = 'apps'
guards = ['requireAuth', 'requireAdmin', 'requirePro']

results = []

for root, dirs, files in os.walk(apps_dir):
    for file in files:
        if file.endswith('.html'):
            html_path = os.path.join(root, file)
            # Read HTML
            with open(html_path, 'r', encoding='utf-8', errors='ignore') as f:
                html_content = f.read()

            # Skip pure redirect stubs that forward immediately to a parent index.html
            if (
                re.search(r'<meta\s+http-equiv=["\']refresh["\'][^>]+url=\.\./index\.html', html_content, re.IGNORECASE)
                and "window.location.replace('../index.html" in html_content
                and os.path.exists(os.path.normpath(os.path.join(root, '../index.html')))
            ):
                continue

            # Check if guards are in HTML
            has_guard = any(guard in html_content for guard in guards)
            
            # Find associated JS files
            js_files = re.findall(r'src="([^"]+\.js)"', html_content)
            for js_file in js_files:
                if has_guard: break
                
                # Try to find the JS file relative to HTML or root
                js_path = os.path.normpath(os.path.join(root, js_file))
                if not os.path.exists(js_path):
                    # Try from root
                    js_path = os.path.normpath(js_file)
                
                if os.path.exists(js_path) and os.path.isfile(js_path):
                    with open(js_path, 'r', encoding='utf-8', errors='ignore') as f:
                        js_content = f.read()
                    if any(guard in js_content for guard in guards):
                        has_guard = True
            
            if not has_guard:
                results.append(html_path)

print("\n".join(results))
