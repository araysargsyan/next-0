'use client'

const validateEmail = (val: string) => {
    if (!val) return "Email is required";
    if (!val.includes("@")) return "Invalid email format (must contain @)";
    return null;
};

const validatePassword = (val: string) => {
    if (!val) return "Password is required";
    if (val.length < 6) return "Password must be at least 6 characters";
    return null;
};

export { validateEmail, validatePassword };
