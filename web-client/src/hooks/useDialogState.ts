import { useCallback, useState } from "react";

interface UseDialogStateOptions {
	onOpen?: () => void;
	onClose?: () => void;
	resetOnClose?: boolean;
}

export function useDialogState<T>(
	initialData: T,
	options: UseDialogStateOptions = {},
) {
	const { onOpen, onClose, resetOnClose = true } = options;

	const [isOpen, setIsOpen] = useState(false);
	const [data, setData] = useState<T>(initialData);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const open = useCallback(() => {
		setIsOpen(true);
		setError(null);
		onOpen?.();
	}, [onOpen]);

	const close = useCallback(() => {
		setIsOpen(false);
		setIsLoading(false);
		setError(null);
		if (resetOnClose) {
			// Use setTimeout to reset data after animation completes
			setTimeout(() => {
				setData(initialData);
			}, 200);
		}
		onClose?.();
	}, [initialData, resetOnClose, onClose]);

	const reset = useCallback(() => {
		setData(initialData);
		setIsLoading(false);
		setError(null);
	}, [initialData]);

	const updateData = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
		setData((prev) => {
			if (typeof updater === "function") {
				return updater(prev);
			}
			return { ...prev, ...updater };
		});
	}, []);

	// Utility function for form field updates
	const updateField = useCallback(
		<K extends keyof T>(field: K, value: T[K]) => {
			setData((prev) => ({ ...prev, [field]: value }));
		},
		[],
	);

	// Handle dialog open state changes (for radix-ui Dialog components)
	const handleOpenChange = useCallback(
		(isOpen: boolean) => {
			if (isOpen) {
				open();
			} else {
				close();
			}
		},
		[open, close],
	);

	return {
		// State
		isOpen,
		data,
		isLoading,
		error,

		// Actions
		open,
		close,
		reset,
		updateData,
		updateField,
		handleOpenChange,

		// Setters (for direct control when needed)
		setIsOpen,
		setData,
		setIsLoading,
		setError,
	};
}

// Type-safe version for forms with specific field types
export function useFormDialogState<T extends Record<string, unknown>>(
	initialData: T,
	options: UseDialogStateOptions = {},
) {
	const dialogState = useDialogState(initialData, options);

	// Type-safe field handler
	const handleFieldChange = useCallback(
		(field: keyof T) =>
			(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
				dialogState.updateField(field, e.target.value as T[keyof T]);
			},
		[dialogState],
	);

	// Validation helper
	const [validationErrors, setValidationErrors] = useState<
		Partial<Record<keyof T, string>>
	>({});

	const validateField = useCallback(
		(field: keyof T, validator: (value: T[keyof T]) => string | null) => {
			const error = validator(dialogState.data[field]);
			setValidationErrors((prev) => ({
				...prev,
				[field]: error,
			}));
			return !error;
		},
		[dialogState.data],
	);

	const clearValidationErrors = useCallback(() => {
		setValidationErrors({});
	}, []);

	return {
		...dialogState,
		handleFieldChange,
		validationErrors,
		validateField,
		clearValidationErrors,
	};
}
