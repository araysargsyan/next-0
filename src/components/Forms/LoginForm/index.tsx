import { Suspense } from "react";
import { signInAction } from "@/app/sign-in/actions";
import Formy from "@/components/UI/Formy";
import InfoMessage from "./InfoMessage";
import FormyError from "@/components/UI/Formy/FormyError";
import { FormySubmit } from "@/components/UI/Formy";
import { handleStateChange, parsePasswordMessage } from "./handlers";

export const dynamic = "force-static";

export default function LoginForm() {
    return (
        <Formy
            id="login-form"
            action={signInAction}
            className="flex flex-col"
            onStateChange={handleStateChange}
        >
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">Sign in</h1>

            <Suspense fallback={null}>
                <InfoMessage />
            </Suspense>

            {/* Email Field Wrapper */}
            <div className="relative mb-6">
                <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    defaultValue="bb@aa.aa"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                />
                <FormyError field="email" below />
            </div>

            {/* Password Field Wrapper */}
            <div className="relative mb-8">
                <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    defaultValue="AAaa12$$"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-black"
                    required
                />
                <FormyError
                    field="password"
                    below
                    hasHelp
                    parseMessage={parsePasswordMessage}
                />
            </div>

            {/* Relative Wrapper for Global Error and Submit Button */}
            <div className="relative">
                <FormyError />
                <FormySubmit
                    loadingLabel="Signing in..."
                    className="w-full bg-black text-white rounded-lg px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                    Sign in
                </FormySubmit>
            </div>
        </Formy>
    );
}
