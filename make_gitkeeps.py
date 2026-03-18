import os
import json

path = '/Users/josearango/Desktop/Clawport/clawport-ui/openclaw-config/openclaw.json'

with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

for agent in data.get('agents', {}).get('list', []):
    agent_dir = agent.get('agentDir')
    agent_ws = agent.get('workspace')
    
    if agent_dir:
        local_dir = agent_dir.replace('/root/.openclaw', '/Users/josearango/Desktop/Clawport/clawport-ui/openclaw-config')
        os.makedirs(local_dir, exist_ok=True)
        with open(os.path.join(local_dir, '.gitkeep'), 'w') as gf: pass
    
    if agent_ws:
        local_ws = agent_ws.replace('/root/.openclaw', '/Users/josearango/Desktop/Clawport/clawport-ui/openclaw-config')
        os.makedirs(local_ws, exist_ok=True)
        with open(os.path.join(local_ws, '.gitkeep'), 'w') as gf: pass
