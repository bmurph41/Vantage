with open('client/src/pages/modeling/projects/workspace/capital-stack.tsx') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# Find the orphan boundaries
iife_close = None
sources_start = None

for i, line in enumerate(lines):
    # Our IIFE close followed by orphaned Tier 2
    if '})()}' in line and i + 1 < len(lines) and 'Tier 2' in lines[i + 1]:
        iife_close = i
        print(f"  IIFE close at line {i + 1}: {line.rstrip()}")
    # Sources & Uses tab start
    if '{/* SOURCES & USES TAB */}' in line:
        sources_start = i
        print(f"  Sources & Uses at line {i + 1}: {line.rstrip()}")

if iife_close is not None and sources_start is not None:
    # Remove lines from iife_close+1 to sources_start-1
    # But we need proper closing tags after the IIFE
    
    orphan_count = sources_start - (iife_close + 1)
    print(f"\n  Removing {orphan_count} orphaned lines ({iife_close + 2} to {sources_start})")
    
    # Build the replacement: proper closing tags for our returns tab
    closing = [
        '                      </CardContent>\n',
        '                    </Card>\n',
        '                  </TabsContent>\n',
        '\n',
    ]
    
    new_lines = lines[:iife_close + 1] + closing + lines[sources_start:]
    
    with open('client/src/pages/modeling/projects/workspace/capital-stack.tsx', 'w') as f:
        f.writelines(new_lines)
    
    print(f"  Replaced {orphan_count} orphaned lines with {len(closing)} closing lines")
    print(f"  New total: {len(new_lines)} lines (was {len(lines)})")
else:
    print(f"  Could not find boundaries: iife_close={iife_close}, sources_start={sources_start}")
