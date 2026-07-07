import { createStore } from "zustand/vanilla";
import {createLogger} from "@/lib/logger";

export interface FormState {
    forms: Record<string, Record<string, string>>;
}

export interface FormActions {
    setFormValue: (formId: string, name: string, value: string) => void;
    clearForm: (formId: string) => void;
}

export type FormStore = FormState & FormActions;

const log = createLogger("FormyStore", "green");

export const createFormStore = (initialState: FormState = { forms: {} }) => {
    return createStore<FormStore>()((set) => ({
        ...initialState,
        setFormValue: (formId, name, value) =>
            set((state) => {
                const updatedForm = {
                    ...(state.forms[formId] || {}),
                    [name]: value,
                };
                const newState = {
                    ...state.forms,
                    [formId]: updatedForm,
                };

                log(`[${formId}] setFormValue`, {formId, name, value, newState});
                return { forms: newState };
            }),
        clearForm: (formId) =>
            set((state) => {
                const newState = { ...state.forms };
                delete newState[formId];

                log(`[${formId}] clearForm`, {formId, newState});
                return { forms: newState };
            }),
    }));
};
