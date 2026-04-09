import re
import json

data_sql_path = '/home/gowtham/Desktop/code-clash/src/main/resources/data.sql'
output_sql_path = '/home/gowtham/Desktop/code-clash/scratch/update_railway_testcases.sql'

with open(data_sql_path, 'r') as f:
    content = f.read()

updates = []
parts = content.split("INSERT INTO problems")
for part in parts[1:]:
    # Find the title (usually the first single-quoted string inside parentheses)
    title_match = re.search(r"\('([^']+)'", part)
    
    if title_match:
        title = title_match.group(1)
        # Find the test cases JSON (starts with '[' and ends with ']')
        # In our data.sql, it's the 7th parameter.
        json_matches = re.findall(r"'(\[.*?\])'", part, re.DOTALL)
        if json_matches:
            test_cases_json = json_matches[-1]
            escaped_json = test_cases_json.replace("'", "''")
            updates.append("UPDATE problems SET test_cases = '{}' WHERE title = '{}';".format(escaped_json, title.replace("'", "''")))

with open(output_sql_path, 'w') as f:
    f.write("\n".join(updates))

print("Generated {} update statements.".format(len(updates)))
