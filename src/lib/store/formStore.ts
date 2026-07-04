import { createStore } from "zustand/vanilla";

export interface FormState {
    forms: Record<string, Record<string, string>>;
}

export interface FormActions {
    setFormValue: (formId: string, name: string, value: string) => void;
    setFormValues: (formId: string, values: Record<string, string>) => void;
    clearForm: (formId: string) => void;
}

export type FormStore = FormState & FormActions;

export const createFormStore = (initialState: FormState = { forms: {} }) => {
    return createStore<FormStore>()((set) => ({
        ...initialState,
        setFormValue: (formId, name, value) =>
            set((state) => {
                const updatedForm = {
                    ...(state.forms[formId] || {}),
                    [name]: value,
                };
                const newForms = {
                    ...state.forms,
                    [formId]: updatedForm,
                };
                console.log(
                    `%c[FormStore] setFormValue → ${formId} [${name}]:`,
                    "color: #e066ff; font-weight: bold;",
                    value,
                    "| Full state:",
                    newForms
                );
                return { forms: newForms };
            }),
        setFormValues: (formId, values) =>
            set((state) => {
                const newForms = {
                    ...state.forms,
                    [formId]: values,
                };
                console.log(
                    `%c[FormStore] setFormValues → ${formId}:`,
                    "color: #32cd32; font-weight: bold;",
                    values,
                    "| Full state:",
                    newForms
                );
                return { forms: newForms };
            }),
        clearForm: (formId) =>
            set((state) => {
                const newForms = { ...state.forms };
                delete newForms[formId];
                console.log(
                    `%c[FormStore] clearForm → ${formId}`,
                    "color: #ff4500; font-weight: bold;",
                    "| Full state:",
                    newForms
                );
                return { forms: newForms };
            }),
    }));
};
