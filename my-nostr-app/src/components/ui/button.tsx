import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 aria-invalid:ring-destructive aria-invalid:ring-offset-2",
	{
		variants: {
			variant: {
				default:
					"bg-slate-900 text-white shadow-sm hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200",
				primary:
					"bg-blue-600 text-white shadow-sm hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600",
				destructive:
					"bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600",
				outline:
					"border border-slate-300 bg-transparent shadow-sm hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100",
				secondary:
					"bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
				ghost:
					"hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100",
				link: "text-blue-600 underline-offset-4 hover:underline dark:text-blue-500",
				success:
					"bg-green-600 text-white shadow-sm hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600",
			},
			size: {
				default: "h-9 px-4 py-2",
				sm: "h-8 px-3 text-xs",
				lg: "h-11 px-8 text-base",
				xl: "h-12 px-10 text-lg",
				icon: "size-9",
				"icon-sm": "size-8",
				"icon-lg": "size-11",
			},
			rounded: {
				default: "rounded-md",
				sm: "rounded-sm",
				lg: "rounded-lg", 
				xl: "rounded-xl",
				full: "rounded-full",
				none: "rounded-none",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			rounded: "default",
		},
	},
);

function Button({
	className,
	variant,
	size,
	rounded,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, rounded, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
