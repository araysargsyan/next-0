import { Suspense } from "react";
import { signInAction } from "@/app/sign-in/actions";
import Formy from "@/components/UI/Formy";
import InfoMessage from "./InfoMessage";
import FormyError from "@/components/UI/Formy/FormyError";
import { handleStateChange } from "./handlers";

export const dynamic = "force-static";

export default function LoginForm() {
    return (
        <Formy
            action={signInAction}
            className="relative overflow-hidden flex flex-col"
            submitLabel="Sign in"
            loadingLabel="Signing in..."
            onStateChange={handleStateChange}
        >
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">Sign in</h1>

            <Suspense fallback={null}>
                <InfoMessage />
            </Suspense>

            <input
                name="email"
                type="email"
                placeholder="Email"
                defaultValue="john.doe@example.com"
                className="w-full border border-gray-300 rounded-lg mb-4 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                required
            />

            <input
                name="password"
                type="password"
                placeholder="Password"
                defaultValue="securepassword123"
                className="w-full border border-gray-300 rounded-lg mb-8 px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                required
            />

            <FormyError />
        </Formy>
    );
}
