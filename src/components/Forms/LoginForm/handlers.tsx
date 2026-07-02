'use client'

import { useRouter } from "next/navigation";
import { FormyActionState } from "@/components/UI/Formy";

export const handleStateChange = (
    state: FormyActionState | null,
    router: ReturnType<typeof useRouter>
) => {
    if (state?.success) {
        localStorage.setItem("was_logged_in", "true");
        router.push("/");
    }
};
