# Button Style Guide

This document outlines the unified button styling system for the Nostr Projects app.

## Button Component Usage

Always use the `Button` component from `@/components/ui/button` instead of native HTML buttons.

```tsx
import { Button } from "@/components/ui/button";
```

## Available Variants

### Primary Actions
- **`variant="default"`** - Default black/white button for standard actions
- **`variant="primary"`** - Blue button for primary CTAs (Create, Save, etc.)
- **`variant="success"`** - Green button for positive actions (Confirm, Start, etc.)

### Secondary Actions
- **`variant="secondary"`** - Gray button for secondary actions
- **`variant="outline"`** - Bordered button with transparent background
- **`variant="ghost"`** - Minimal button with hover state only

### Destructive Actions
- **`variant="destructive"`** - Red button for delete/dangerous actions

### Navigation
- **`variant="link"`** - Text-only button styled as a link

## Sizes

- **`size="default"`** - Standard button size (h-9)
- **`size="sm"`** - Small button (h-8)
- **`size="lg"`** - Large button (h-11)
- **`size="xl"`** - Extra large button (h-12)
- **`size="icon"`** - Square icon button (size-9)
- **`size="icon-sm"`** - Small icon button (size-8)
- **`size="icon-lg"`** - Large icon button (size-11)

## Border Radius

- **`rounded="default"`** - Standard radius (rounded-md)
- **`rounded="sm"`** - Small radius (rounded-sm)
- **`rounded="lg"`** - Large radius (rounded-lg)
- **`rounded="xl"`** - Extra large radius (rounded-xl)
- **`rounded="full"`** - Fully rounded (rounded-full)
- **`rounded="none"`** - No radius (rounded-none)

## Common Patterns

### Floating Action Button
```tsx
<Button
  variant="primary"
  size="icon-lg"
  rounded="full"
  className="shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95"
>
  <Plus className="w-6 h-6" />
</Button>
```

### Primary CTA Button
```tsx
<Button variant="primary" size="default">
  Create Project
</Button>
```

### Icon Button
```tsx
<Button variant="ghost" size="icon">
  <Settings className="w-4 h-4" />
</Button>
```

### Full Width Button
```tsx
<Button variant="primary" className="w-full">
  Continue
</Button>
```

## Dark Mode

All button variants automatically adapt to dark mode. The button component handles the color transitions internally.

## Custom Styling

When absolutely necessary, you can add custom classes via the `className` prop, but prefer using the built-in variants and sizes when possible.

```tsx
// Only for specific overrides not covered by variants
<Button
  variant="primary"
  className="bg-purple-600 hover:bg-purple-700"
>
  Custom Purple Button
</Button>
```

## Migration Notes

When updating from custom buttons to the unified system:
1. Replace `<button>` with `<Button>`
2. Map custom colors to appropriate variants
3. Use the `rounded` prop instead of custom rounded classes
4. Prefer variant props over custom className styling