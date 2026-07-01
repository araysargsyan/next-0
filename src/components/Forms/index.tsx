import { ReactNode, ComponentProps } from "react";
import Form from "next/form";

interface FormyProps extends ComponentProps<typeof Form> {
    submitLabel?: string;
    children: ReactNode;
}

export default function Formy({
    submitLabel,
    children,
    className = "flex flex-col gap-4 w-full max-w-sm",
    ...props
}: FormyProps) {
    return (
        <Form className={className} {...props}>
            {children}
            {submitLabel && (
                <button
                    type="submit"
                    className="bg-black text-white rounded-lg px-4 py-2 hover:opacity-80 transition-opacity"
                >
                    {submitLabel}
                </button>
            )}
        </Form>
    );
}
