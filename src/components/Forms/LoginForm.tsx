"use client";

import {useActionState, Suspense, useEffect, useState} from "react";
import {signInAction} from "@/app/sign-in/actions";
import Formy from "./index";
import {useSearchParams} from "next/navigation";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";

function InfoMessage() {
    const searchParams = useSearchParams();
    const [message, setMessage] = useState<string | null>(null);

    useIsomorphicLayoutEffect(() => {
        const errorType = searchParams.get("error");
        const wasLoggedIn = localStorage.getItem("was_logged_in");

        if (errorType === "session_expired" || wasLoggedIn === "true") {
            setMessage("Your session has expired. Please sign in again.");
            // Clear the flag so it doesn't show again on manual reload
            localStorage.removeItem("was_logged_in");
        }
    }, [searchParams]);

    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => {
                setMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    if (!message) return null;

    return (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 bg-white border border-amber-200 text-amber-800 px-4 py-3 rounded-xl shadow-lg max-w-sm">
            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <div className="text-sm font-medium">{message}</div>
            <button 
                type="button" 
                onClick={() => setMessage(null)}
                className="text-amber-400 hover:text-amber-600 transition-colors ml-2 font-bold text-lg leading-none"
            >
                &times;
            </button>
        </div>
    );
}

export default function LoginForm() {
    const [state, action, isPending] = useActionState(signInAction, {error: ""});

    const handleSubmit = () => {
        localStorage.setItem("was_logged_in", "true");
    };

    useEffect(() => {
        if (state?.error) {
            localStorage.removeItem("was_logged_in");
        }
    }, [state]);

    return (
        <Formy
            action={action}
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 w-full max-w-sm bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
        >
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Sign in</h1>

            <Suspense fallback={null}>
                <InfoMessage />
            </Suspense>

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
        </Formy>
    );
}
