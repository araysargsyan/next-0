import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/app/sign-in/actions";
import Formy, { FormyError, FormySubmit } from "@/libs/formy";
import InfoMessage from "./InfoMessage";
import { handleStateChange, parsePasswordMessage } from "./handlers";
import {validateEmail, validatePassword} from "./validators";

export const dynamic = "force-static";

export default function LoginForm() {
    const router = useRouter();
    return (
        <Formy
            id="login-form"
            action={signInAction}
            className="flex flex-col"
            onStateChange={(state) => handleStateChange(state, router)}
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
                <FormyError field="email" below validate={validateEmail} />
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
                    parseMessage={parsePasswordMessage}
                    validate={validatePassword}
                />
            </div>

            {/* Remember Me Checkbox Wrapper (Temporary) */}
            <div className="flex items-center gap-2 mb-6">
                <input
                    id="remember"
                    name="remember"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <label htmlFor="remember" className="text-sm text-gray-700 cursor-pointer select-none">
                    Remember me
                </label>
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
