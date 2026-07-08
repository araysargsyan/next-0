'use client'

import { useRouter } from "next/navigation";
import { FormyActionState } from "@/components/UI/Formy";

export const handleStateChange = (
    state: FormyActionState | null,
    router: ReturnType<typeof useRouter>
) => {
    if (state && "data" in state) {
        localStorage.setItem("was_logged_in", "true");
        router.push("/");
    }
};

export const parsePasswordMessage = (msg: string) => {
    const dotIndex = msg.indexOf(". ");
    if (dotIndex !== -1) {
        return {
            title: msg.slice(0, dotIndex + 1),
            info: msg.slice(dotIndex + 2),
        };
    }
    return { title: msg, info: "" };
};
