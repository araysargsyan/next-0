"use client";

import { useState, useRef, useEffect, useLayoutEffect, RefObject } from "react";
import { useFormyErrors, useFormyState } from "@/libs/formy";
import { FieldError } from "./FieldError";

const PRODUCT_NAMES = [
    "New Product",
    "Limited Edition",
    "Premium Pack",
    "Basic Bundle",
    "Special Edition",
    "Starter Kit",
    "Pro Series",
];

interface ProductNameSelectProps {
    name: string;
    defaultValue?: string;
    label?: string;
}

export function ProductNameSelect({
    name,
    defaultValue = PRODUCT_NAMES[0],
    label = "Product name:",
}: ProductNameSelectProps) {
    const { clearFieldError } = useFormyErrors(name);
    const { state } = useFormyState();
    const [isOpen, setIsOpen] = useState(false);
    const [selected, setSelected] = useState(defaultValue);
    const containerRef: RefObject<HTMLDivElement | null> = useRef(null);
    const hiddenInputRef = useRef<HTMLInputElement>(null);

    // Render-time state adjustment: reset selection on success
    // (React-sanctioned pattern — no effect needed for derived state reset)
    if (state && "data" in state && selected !== defaultValue) {
        setSelected(defaultValue);
    }

    // Sync hidden input value after server action (before paint)
    useLayoutEffect(() => {
        if (hiddenInputRef.current) {
            hiddenInputRef.current.value = selected;
        }
    }, [state, selected]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelect = (value: string) => {
        setSelected(value);
        setIsOpen(false);
        clearFieldError?.(name);
    };

    return (
        <div className="relative mb-6">
            {label && (
                <label style={{ display: "block", marginBottom: "5px", color: "#1a1a1a" }}>{label}</label>
            )}

            {/* Hidden input carries the value into FormData */}
            <input ref={hiddenInputRef} type="hidden" name={name} value={selected} />

            {/* Custom trigger button */}
            <div ref={containerRef} style={{ position: "relative" }}>
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    style={{
                        width: "100%",
                        padding: "8px 36px 8px 12px",
                        borderRadius: "4px",
                        border: "1px solid #ddd",
                        backgroundColor: "#fff",
                        color: "#1a1a1a",
                        textAlign: "left",
                        cursor: "pointer",
                        fontSize: "14px",
                        position: "relative",
                    }}
                >
                    {selected}
                    {/* Chevron icon */}
                    <span
                        style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform: isOpen ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)",
                            transition: "transform 0.2s ease",
                            pointerEvents: "none",
                            fontSize: "10px",
                            color: "#666",
                        }}
                    >
                        ▼
                    </span>
                </button>

                {/* Dropdown list */}
                {isOpen && (
                    <ul
                        style={{
                            position: "absolute",
                            top: "calc(100% + 4px)",
                            left: 0,
                            right: 0,
                            margin: 0,
                            padding: "4px 0",
                            listStyle: "none",
                            backgroundColor: "#fff",
                            color: "#1a1a1a",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                            zIndex: 50,
                        }}
                    >
                        {PRODUCT_NAMES.map((option) => (
                            <li
                                key={option}
                                onClick={() => handleSelect(option)}
                                style={{
                                    padding: "8px 12px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    backgroundColor: selected === option ? "#f0f0f0" : "transparent",
                                    fontWeight: selected === option ? 600 : 400,
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLElement).style.backgroundColor = "#f5f5f5";
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.backgroundColor =
                                        selected === option ? "#f0f0f0" : "transparent";
                                }}
                            >
                                {option}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <FieldError field={name} />
        </div>
    );
}
