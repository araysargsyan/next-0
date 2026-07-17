"use client";

import { useEffect, useRef, useActionState } from "react";

// Простой экшен, имитирующий задержку сети
async function testAction(prevState: any, formData: FormData) {
    const value = formData.get("testInput");
    console.log("Action started with value:", value);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("Action completed");
    return { success: true, value };
}

export default function ResetTestForm() {
    const formRef = useRef<HTMLFormElement>(null);
    const [state, formAction, isPending] = useActionState(testAction, null);

    useEffect(() => {
        const form = formRef.current;
        if (!form) return;

        const handleReset = (e: Event) => {
            console.log("⚠️ Reset event intercepted and prevented!");
            e.preventDefault(); // Перехватываем и отменяем сброс
        };

        form.addEventListener("reset", handleReset);
        return () => {
            form.removeEventListener("reset", handleReset);
        };
    }, []);

    return (
        <form ref={formRef} action={formAction} className="p-4 border rounded shadow space-y-4 max-w-md">
            <h3 className="text-lg font-bold text-gray-800">Reset Event Interception Test</h3>
            <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Test Field:</label>
                <input
                    type="text"
                    name="testInput"
                    placeholder="Type something..."
                    className="border p-2 rounded w-full text-black bg-white"
                />
            </div>
            <button
                type="submit"
                disabled={isPending}
                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded disabled:opacity-50"
            >
                {isPending ? "Submitting..." : "Submit"}
            </button>
            {state && (
                <div className="text-sm text-green-600 font-medium">
                    Last submitted value: {state.value}
                </div>
            )}
        </form>
    );
}
