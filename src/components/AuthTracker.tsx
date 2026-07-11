"use client";
import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

function AuthTrackerInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (searchParams.get("was_logged_in") === "true") {
            localStorage.setItem("was_logged_in", "true");

            // Очищаем URL-параметр, чтобы адресная строка оставалась чистой
            const params = new URLSearchParams(searchParams.toString());
            params.delete("was_logged_in");
            const newQuery = params.toString();
            const newUrl = pathname + (newQuery ? `?${newQuery}` : "");
            router.replace(newUrl);
        }
    }, [searchParams, router, pathname]);

    return null;
}

export default function AuthTracker() {
    return (
        <Suspense fallback={null}>
            <AuthTrackerInner />
        </Suspense>
    );
}
