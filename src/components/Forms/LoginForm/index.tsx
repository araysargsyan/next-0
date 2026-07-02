import { Suspense } from "react";
import { signInAction } from "@/app/sign-in/actions";
import Formy from "../index";
import InfoMessage from "./InfoMessage";
import {submitHandler} from "./handlers";

export default function LoginForm() {
    return (
        <Formy
            action={signInAction}
            className="flex flex-col gap-4 w-full max-w-sm bg-white p-8 rounded-2xl shadow-lg border border-gray-100"
            submitLabel="Sign in"
            loadingLabel="Signing in..."
            onSubmit={submitHandler}
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
        </Formy>
    );
}
