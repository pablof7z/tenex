#\!/bin/bash

# Get all source files (excluding tests)
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | grep -v "__tests__" | sort)

echo "Checking for orphaned files..."
echo "=============================="
echo

for file in $files; do
    # Get the basename without extension
    basename=$(basename "$file" | sed 's/\.[^.]*$//')
    # Get the relative path from src
    relative_path=${file#src/}
    
    # Skip index files as they're often entry points
    if [[ "$basename" == "index" ]]; then
        continue
    fi
    
    # Skip the main CLI entry point
    if [[ "$file" == "src/cli.ts" ]] || [[ "$file" == "src/index.ts" ]]; then
        continue
    fi
    
    # Search for imports of this file
    # Look for various import patterns
    import_count=$(rg -c "from ['\"].*$(echo $relative_path | sed 's/\.[^.]*$//')" src/ 2>/dev/null | grep -v "^$file:" | wc -l)
    
    # Also check for imports with .js extension
    import_count_js=$(rg -c "from ['\"].*$(echo $relative_path | sed 's/\.[^.]*$//').js" src/ 2>/dev/null | grep -v "^$file:" | wc -l)
    
    # Check for imports using just the filename
    import_count_name=$(rg -c "from ['\"].*/$basename['\"]" src/ 2>/dev/null | grep -v "^$file:" | wc -l)
    
    # Check for dynamic imports
    dynamic_import_count=$(rg -c "import\(['\"].*$(echo $relative_path | sed 's/\.[^.]*$//')" src/ 2>/dev/null | grep -v "^$file:" | wc -l)
    
    # Check for require statements
    require_count=$(rg -c "require\(['\"].*$(echo $relative_path | sed 's/\.[^.]*$//')" src/ 2>/dev/null | grep -v "^$file:" | wc -l)
    
    total_imports=$((import_count + import_count_js + import_count_name + dynamic_import_count + require_count))
    
    if [ $total_imports -eq 0 ]; then
        echo "POTENTIALLY ORPHANED: $file"
        # Show what the file exports to understand its purpose
        echo "  Exports:"
        rg "^export" "$file" | head -5 | sed 's/^/    /'
        echo
    fi
done

