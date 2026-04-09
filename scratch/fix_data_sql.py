import re
import json

path = '/home/gowtham/Desktop/code-clash/src/main/resources/data.sql'
with open(path, 'r') as f:
    content = f.read()

def fix_test_cases(match):
    json_str = match.group(0)
    try:
        data = json.loads(json_str)
        if isinstance(data, list):
            # Ensure there are 15 test cases
            if len(data) < 15:
                # Add placeholders if needed (optional, but good for consistency)
                pass 
            
            # Set exactly first 3 as sample: true
            for i, tc in enumerate(data):
                tc['sample'] = (i < 3)
            
            # Return fixed JSON
            return json.dumps(data, ensure_ascii=False)
    except:
        pass
    return json_str

# Match JSON arrays in the problems table INSERTs
# This regex looks for [...] patterns within the VALUES part of INSERT INTO problems
# It's simplified but should work for the data.sql structure
pattern = r'\[\{"input":.*?\}\]'
fixed_content = re.sub(pattern, fix_test_cases, content)

with open(path, 'w') as f:
    f.write(fixed_content)
