export function runFormValidation(
    validators: Record<
        string,
        {
            validate: (value: string) => string | null;
            setError: (error: string | null) => void;
        }
    >,
    getValue: (name: string) => string
): boolean {
    let hasErrors = false;
    Object.entries(validators).forEach(([name, entry]) => {
        const error = entry.validate(getValue(name));
        entry.setError(error);
        if (error) {
            hasErrors = true;
        }
    });
    return hasErrors;
}
