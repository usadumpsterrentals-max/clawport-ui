import os

def fix_paths(d):
    for root, dirs, files in os.walk(d):
        for f in files:
            if f.endswith('.json') or f.endswith('.jsonl') or f.endswith('.md'):
                path = os.path.join(root, f)
                try:
                    with open(path, 'r', encoding='utf-8') as file:
                        content = file.read()
                    
                    if '/Users/josearango/.openclaw' in content:
                        content = content.replace('/Users/josearango/.openclaw', '/root/.openclaw')
                    if '"bind": "loopback"' in content:
                        content = content.replace('"bind": "loopback"', '"bind": "0.0.0.0"')
                        
                    with open(path, 'w', encoding='utf-8') as file:
                        file.write(content)
                except Exception:
                    pass

fix_paths('/Users/josearango/Desktop/Clawport/clawport-ui/openclaw-config')
