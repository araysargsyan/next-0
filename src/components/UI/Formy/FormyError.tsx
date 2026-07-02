'use client'
import { useContext, useRef, useState } from "react";
import { FormyContext } from "./FormyContext";
import useIsomorphicLayoutEffect from "@/hooks/useIsomorphicLayoutEffect";

export default function FormyError() {
    const { state } = useContext(FormyContext);
    const anchorRef = useRef<HTMLDivElement>(null);
    const [anchorTop, setAnchorTop] = useState(0);
    const error = (state && "error" in state ? state.error : null) ?? null;

    useIsomorphicLayoutEffect(() => {
        if (anchorRef.current && error) {
            setAnchorTop(anchorRef.current.offsetTop);
        }
    }, [error]);

    return (
        <>
            {/* Zero-height anchor — occupies its natural position in the flex flow */}
            <div ref={anchorRef} />

            {/* Error banner — absolutely pinned to the anchor's measured position */}
            <div
                style={{
                    position: "absolute",
                    top: anchorTop,
                    left: 0,
                    right: 0,
                    transform: error ? `translateY(-100%)` : `translateY(calc(-100% - ${anchorTop+1}px))`,
                    opacity: error ? 1 : 0,
                    transition: "opacity 0.2s ease-in-out, transform 0.2s ease-in-out",
                    pointerEvents: error ? "auto" : "none",
                }}
                className="text-rose-800 text-sm flex items-center gap-2"
            >
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                <div className="font-medium">{error}</div>
            </div>
        </>
    );
}
