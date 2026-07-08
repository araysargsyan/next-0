import {ReactNode, ComponentProps, RefObject} from "react";
import { useRouter } from "next/navigation";
import Form from "next/form";

export type FormyActionState =
    | { error: string | Record<string, string> | null }
    | { data: unknown };

export type StrictFormyState<T> = {
    [K in keyof T]: K extends "error" | "data" ? T[K] : never
};

export interface FormyProps<State extends FormyActionState & StrictFormyState<State> = FormyActionState>
    extends Omit<ComponentProps<typeof Form>, "children" | "action"> {
    action?: string | ((state: Awaited<State> | null, payload: FormData) => State | Promise<State>);
    initialState?: Awaited<State> | null;
    children?: ReactNode | ((state: State | null, isPending: boolean) => ReactNode);
    onStateChange?: (state: State | null, router: ReturnType<typeof useRouter>) => void;
    clearOnSuccess?: boolean;
}

export interface FormyStoreSlice {
    forms: Record<string, Record<string, string>>;
    setFormValue: (formId: string, name: string, value: string) => void;
    clearForm: (formId: string) => void;
}

export interface FormyPersistAdapter {
    getValues: () => Record<string, string> | undefined;
    setValue: (name: string, value: string) => void;
    clear: () => void;
}

export type GetStateFn<Store extends FormyStoreSlice = FormyStoreSlice> = () => Store;

export interface FormyCoreProps<State extends FormyActionState & StrictFormyState<State>> extends Omit<
    FormyProps<State>,
    'children' | 'action' | 'initialState' | 'onStateChange' | 'clearOnSuccess'
> {
    children: ReactNode;
    clearFieldError: (name: string) => void;
    formAction: ComponentProps<typeof Form>['action'] | undefined;
    setValue: (name: string, value: string) => void;
    validatorsRef: RefObject<Record<string, {
        validate: (value: string) => string | null;
        setError: (error: string | null) => void;
    }>>;
    formRef: RefObject<HTMLFormElement | null>;
    savedFilesRef: RefObject<Record<string, File[]>>;
    savedValuesRef: RefObject<Record<string, string>>;
    isRestoringRef: RefObject<boolean>;
}
