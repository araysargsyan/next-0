// utils/createErrorsStore.ts
export interface ErrorsStore {
    getSnapshot: () => Record<string, string> | null;
    setErrors: (next: Record<string, string> | null) => void;
    subscribe: (listener: () => void) => () => void;
}

export function createErrorsStore(initial: Record<string, string> | null): ErrorsStore {
    let errors = initial;
    const listeners = new Set<() => void>();
    return {
        getSnapshot: () => errors,
        setErrors: (next) => {
            if (next === errors) return;
            errors = next;
            listeners.forEach((l) => l());
        },
        subscribe: (listener) => {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}
