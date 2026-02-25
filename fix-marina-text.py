#!/usr/bin/env python3
"""
Marina Text Sweep — Auto-Fix Script
Replaces marina-specific UI text with asset-class-generic text.
Run from project root: python3 fix-marina-text.py
"""
import os, re, shutil
from datetime import datetime

BACKUP = f'backups/marina-sweep-{datetime.now().strftime("%Y%m%d-%H%M%S")}'

# Safe replacements for UI-facing strings (not variable names, not MarinaMatch brand)
REPLACEMENTS = [
    # Wizard / Onboarding
    ('"Marina Details"', '"Property Details"'),
    ("'Marina Details'", "'Property Details'"),
    ('"Add Marina"', '"Add Property"'),
    ("'Add Marina'", "'Add Property'"),
    ('"Marina Info"', '"Property Info"'),
    ("'Marina Info'", "'Property Info'"),
    ('"Your Marina"', '"Your Property"'),
    ("'Your Marina'", "'Your Property'"),
    ('"this marina"', '"this property"'),
    ("'this marina'", "'this property'"),
    ('"the marina"', '"the property"'),
    ("'the marina'", "'the property'"),
    ('"a marina"', '"a property"'),
    ("'a marina'", "'a property'"),

    # Plurals
    ('"marinas"', '"properties"'),
    ("'marinas'", "'properties'"),
    ('"Marinas"', '"Properties"'),
    ("'Marinas'", "'Properties'"),

    # Sidebar / Navigation
    ('"Marina Analysis"', '"Investment Analysis"'),
    ("'Marina Analysis'", "'Investment Analysis'"),
    ('"Marina Dashboard"', '"Portfolio Dashboard"'),
    ("'Marina Dashboard'", "'Portfolio Dashboard'"),
    ('"Marina Intelligence"', '"Market Intelligence"'),
    ("'Marina Intelligence'", "'Market Intelligence'"),

    # CRM / Pipeline
    ('"Marina CRM"', '"Deal CRM"'),
    ("'Marina CRM'", "'Deal CRM'"),

    # Storage / Slips (context-dependent)
    ('"boat storage"', '"storage"'),
    ("'boat storage'", "'storage'"),
    ('"Boat Storage"', '"Storage"'),
    ("'Boat Storage'", "'Storage'"),

    # Descriptions
    ('"marina operation"', '"property operation"'),
    ("'marina operation'", "'property operation'"),
    ('"marina investment"', '"property investment"'),
    ("'marina investment'", "'property investment'"),
    ('"marina property"', '"property"'),
    ("'marina property'", "'property'"),
    ('"marina project"', '"project"'),
    ("'marina project'", "'project'"),
]

def safe_replace(filepath):
    """Apply safe UI text replacements to a file."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    original = content
    changes = 0

    for old, new in REPLACEMENTS:
        count = content.count(old)
        if count > 0:
            content = content.replace(old, new)
            changes += count

    if content != original:
        dest = os.path.join(BACKUP, filepath)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(filepath, dest)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  ✅ {filepath} ({changes} replacements)')
        return changes
    return 0

if __name__ == '__main__':
    print('\n🔄 Marina Text Sweep — Safe UI Text Replacements')
    print('=' * 60)

    total = 0
    files_changed = 0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ('node_modules', '.git', 'backups', 'dist', 'build', '.next')]
        for fname in files:
            if fname.endswith(('.ts', '.tsx', '.js', '.jsx')):
                fpath = os.path.join(root, fname)
                count = safe_replace(fpath)
                if count > 0:
                    files_changed += 1
                total += count

    print(f'\n✅ Done: {total} total replacements across {files_changed} files')
    print(f'📦 Backups in: {BACKUP}')
    print('\n⚠️  Review changes carefully before committing!')
    print('   Variable names, enum values, and MarinaMatch brand were NOT touched.')
    print('   Run: npm run build   to verify no errors.')
