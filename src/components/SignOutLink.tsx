"use client";

import { ComponentProps } from "react";

export default function SignOutLink({ children, ...props }: ComponentProps<"a">) {
    const handleSignOut = () => {
        localStorage.removeItem("was_logged_in");
    };

    return (
        <a href="/api/auth/sign-out" onClick={handleSignOut} {...props}>
            {children}
        </a>
    );
}
