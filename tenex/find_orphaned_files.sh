#\!/bin/bash

echo "Finding orphaned TypeScript/JavaScript files in src/"
echo "===================================================="
echo

# Function to check if a file is imported
check_file_imports() {
    local file=$1
    local filename=$(basename "$file")
    local dirname=$(dirname "$file")
    local basename_no_ext=${filename%.*}
    
    # Skip checking for imports in the file itself
    local exclude_pattern="^$file:"
    
    # Various import patterns to check
    local patterns=(
        # Relative imports from parent directories
        "\.\./[^'\"]*$basename_no_ext['\"]"
        "\.\./[^'\"]*$basename_no_ext\.js['\"]"
        # Relative imports from same directory
        "\./$basename_no_ext['\"]"
        "\./$basename_no_ext\.js['\"]"
        # Absolute imports using @/
        "@/${file#src/}"
        "@/[^'\"]*$basename_no_ext['\"]"
        # Module path imports
        "${file#src/}"
        "${file#src/}\.js"
    )
    
    local total_imports=0
    
    for pattern in "${patterns[@]}"; do
        local count=$(rg -c "$pattern" src/ 2>/dev/null | grep -v "$exclude_pattern" | wc -l)
        total_imports=$((total_imports + count))
    done
    
    # Also check for barrel exports (index.ts files that might export this file)
    if [ -f "$dirname/index.ts" ]; then
        local index_exports=$(rg -c "from ['\"]\./$basename_no_ext" "$dirname/index.ts" 2>/dev/null || echo 0)
        total_imports=$((total_imports + index_exports))
    fi
    
    return $total_imports
}

# Get all source files (excluding tests)
files=$(find src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | grep -v "__tests__" | sort)

orphaned_files=()

for file in $files; do
    # Skip entry points
    if [[ "$file" == "src/cli.ts" ]] || [[ "$file" == "src/index.ts" ]]; then
        continue
    fi
    
    # Skip test files
    if [[ "$file" == *".test.ts" ]] || [[ "$file" == *".test.tsx" ]]; then
        continue
    fi
    
    check_file_imports "$file"
    import_count=$?
    
    if [ $import_count -eq 0 ]; then
        orphaned_files+=("$file")
    fi
done

# Display results
if [ ${#orphaned_files[@]} -eq 0 ]; then
    echo "No orphaned files found\!"
else
    echo "Found ${#orphaned_files[@]} potentially orphaned files:"
    echo
    
    for file in "${orphaned_files[@]}"; do
        echo "📄 $file"
        
        # Show file info
        echo "   Size: $(wc -c < "$file" | xargs) bytes"
        echo "   Lines: $(wc -l < "$file" | xargs)"
        
        # Show exports
        exports=$(rg "^export" "$file" 2>/dev/null | head -3)
        if [ -n "$exports" ]; then
            echo "   Exports:"
            echo "$exports" | sed 's/^/     - /'
        fi
        
        # Show any TODO or DEPRECATED comments
        todos=$(rg "(TODO|DEPRECATED|FIXME)" "$file" 2>/dev/null | head -2)
        if [ -n "$todos" ]; then
            echo "   Notes:"
            echo "$todos" | sed 's/^/     - /'
        fi
        
        echo
    done
fi

# Additional check for files that might be CLI tools or scripts
echo "Checking for potential standalone scripts/tools:"
echo "----------------------------------------------"
for file in "${orphaned_files[@]}"; do
    # Check if file has a shebang or main execution block
    if head -1 "$file" | grep -q "^#\!" || rg -q "if \(__name__ ==|if \(import\.meta\.main\)" "$file"; then
        echo "🔧 $file (appears to be a standalone script)"
    fi
done

