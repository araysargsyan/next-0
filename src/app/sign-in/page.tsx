"use client";

import {useActionState} from "react";
import {signInAction} from "./actions";
import Form from "next/form";
import {useSearchParams} from "next/navigation";

export default function LoginPage() {
    const [state, action, isPending] = useActionState(signInAction, {error: ""});
    const searchParams = useSearchParams();
    const errorType = searchParams.get("error");

    const getErrorMessage = (type: string | null) => {
        switch (type) {
            case "session_expired":
                return "Your session has expired. Please sign in again.";
            default:
                return null;
        }
    };

    const infoMessage = getErrorMessage(errorType);

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-50">
            <Form
                action={action}
                className="flex flex-col gap-4 w-full max-w-sm bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
            >
                <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Sign in</h1>

                {infoMessage && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm text-center mb-2">
                        {infoMessage}
                    </div>
                )}

                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    defaultValue="john.doe@example.com"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                />
                <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    defaultValue="securepassword123"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                />

                {state?.error && (
                    <p className="text-red-500 text-sm text-center font-medium">{state.error}</p>
                )}

                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-black text-white rounded-lg px-4 py-3 font-semibold hover:bg-gray-800 transition disabled:opacity-50"
                >
                    {isPending ? "Loading..." : "Sign in"}
                </button>
            </Form>
        </div>
    );
}
