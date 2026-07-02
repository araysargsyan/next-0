"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";

export default function InfoMessage() {
    const searchParams = useSearchParams();
    const [message, setMessage] = useState<string | null>(null);

    useIsomorphicLayoutEffect(() => {
        const errorType = searchParams.get("error");
        const wasLoggedIn = localStorage.getItem("was_logged_in");

        if (errorType === "session_expired" || wasLoggedIn === "true") {
            setMessage("Your session has expired. Please sign in again.");
            // Clear the flag so it doesn't show again on manual reload
            localStorage.removeItem("was_logged_in");
        } else if (errorType === "invalid_credentials") {
            setMessage("Invalid email or password.");
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
