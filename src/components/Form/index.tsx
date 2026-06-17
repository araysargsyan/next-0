import {ReactNode} from "react";

interface ServerFormProps {
    action?: (formData: FormData) => Promise<void>;
    submitLabel?: string;
    children: ReactNode;
}

export default function Form({
   action,
   submitLabel = "Submit",
   children,
}: ServerFormProps) {
    return (
        <form action={action} className="flex flex-col gap-4 w-full max-w-sm">
            {children}

            <button
                type="submit"
                className="bg-black text-white rounded-lg px-4 py-2 hover:opacity-80 transition-opacity"
            >
                {submitLabel}
            </button>
        </form>
    );
}
