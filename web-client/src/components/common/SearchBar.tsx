import { Search, X } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface SearchBarProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    autoFocus?: boolean;
    onClear?: () => void;
}

export function SearchBar({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
    disabled = false,
    autoFocus = false,
    onClear,
}: SearchBarProps) {
    const handleClear = () => {
        onChange("");
        onClear?.();
    };

    return (
        <div className={`relative ${className}`}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
            <Input
                type="search"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="pl-10 pr-10"
                disabled={disabled}
                autoFocus={autoFocus}
            />
            {value && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 w-6 h-6"
                    onClick={handleClear}
                    disabled={disabled}
                    type="button"
                >
                    <X className="w-3 h-3" />
                    <span className="sr-only">Clear search</span>
                </Button>
            )}
        </div>
    );
}

// Variant with just an icon button (for headers/toolbars)
interface SearchIconButtonProps {
    onClick: () => void;
    size?: "sm" | "md" | "lg";
    className?: string;
    disabled?: boolean;
}

export function SearchIconButton({
    onClick,
    size = "md",
    className = "",
    disabled = false,
}: SearchIconButtonProps) {
    const sizeClasses = {
        sm: "w-8 h-8",
        md: "w-9 h-9",
        lg: "w-10 h-10",
    };

    const iconSizeClasses = {
        sm: "w-4 h-4",
        md: "w-5 h-5",
        lg: "w-6 h-6",
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className={`${sizeClasses[size]} ${className}`}
            onClick={onClick}
            disabled={disabled}
        >
            <Search className={iconSizeClasses[size]} />
            <span className="sr-only">Search</span>
        </Button>
    );
}
