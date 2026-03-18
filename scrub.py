import os
import re

def scrub_dir(d):
    for root, dirs, files in os.walk(d):
        for f in files:
            if f in ['auth-profiles.json', 'models.json', 'config-audit.jsonl'] or f.endswith('.jsonl') or f.endswith('.json.bak'):
                path = os.path.join(root, f)
                with open(path, 'r') as file:
                    content = file.read()
                
                # Regex to find OpenAI, Anthropic, xAI keys
                content = re.sub(r'sk-[A-Za-z0-9_-]{20,80}', '<PULLED_BY_SECURITY>', content)
                content = re.sub(r'sk-ant-api03-[A-Za-z0-9_-]+', '<PULLED_BY_SECURITY>', content)
                content = re.sub(r'xai-[A-Za-z0-9_-]+', '<PULLED_BY_SECURITY>', content)
                
                with open(path, 'w') as file:
                    file.write(content)

scrub_dir('/Users/josearango/Desktop/Clawport/clawport-ui/openclaw-config')
