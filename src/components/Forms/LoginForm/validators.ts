'use client'

const validateEmail = (val: string) => {
    if (!val) return "Email is required";
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(val)) return "Invalid email format";
    return null;
};

const validatePassword = (val: string) => {
    if (!val) return "Password is required";
    
    const hasUppercase = /[A-Z]/.test(val);
    const hasLowercase = /[a-z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const hasSymbol = /[^A-Za-z0-9]/.test(val);
    
    if (val.length < 8 || !hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
        return "Password is too weak. It must be at least 8 characters long and contain uppercase, lowercase, numbers, and symbols.";
    }
    return null;
};

export { validateEmail, validatePassword };

