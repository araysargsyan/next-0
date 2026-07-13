"use client";

import {useContext} from "react";
import {FormyContext} from "../contexts";

export const useFormyState = () => {
    const ctx = useContext(FormyContext);
    if (!ctx) {
        throw new Error("useFormyState must be used within a <Formy> component.");
    }

    return ctx
};
