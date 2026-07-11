'use client'

export const parsePasswordMessage = (msg: string) => {
    const dotIndex = msg.indexOf(". ");
    if (dotIndex !== -1) {
        return {
            title: msg.slice(0, dotIndex + 1),
            info: msg.slice(dotIndex + 2),
        };
    }
    return { title: msg, info: "" };
};
