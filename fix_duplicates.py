import re

with open('shared/schema.ts', 'r') as f:
    content = f.read()

# Split into table definitions
# Find all pgTable definitions and process each one
lines = content.split('\n')
result = []
i = 0

while i < len(lines):
    line = lines[i]
    result.append(line)
    
    # Check if we're starting a pgTable definition
    if 'pgTable(' in line or 'pgTable (' in line:
        seen_fields = set()
        table_lines = [line]
        brace_count = line.count('{') - line.count('}')
        i += 1
        
        while i < len(lines) and brace_count > 0:
            current_line = lines[i]
            brace_count += current_line.count('{') - current_line.count('}')
            
            # Extract field name if this is a field definition
            field_match = re.match(r'\s+(\w+):\s*(varchar|text|integer|boolean|timestamp|serial|uuid|numeric|date|jsonb)', current_line)
            
            if field_match:
                field_name = field_match.group(1)
                if field_name in seen_fields:
                    # Skip duplicate field
                    print(f"Removing duplicate field '{field_name}' at line {i+1}")
                    i += 1
                    continue
                seen_fields.add(field_name)
            
            result.append(current_line)
            i += 1
        continue
    i += 1

with open('shared/schema.ts', 'w') as f:
    f.write('\n'.join(result))

print("Done! Duplicates removed.")
