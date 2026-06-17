const COLORS = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m'
} as const;

export type LogColor = keyof typeof COLORS;

export function createLogger(prefix: string, color: LogColor = 'reset') {
    const c = COLORS[color] || COLORS.reset;
    return (msg: string, ...args: any[]) => {
        // Убеждаемся, что между префиксом и сообщением всегда есть пробел
        const separator = ' ';
        console.log(`${c}${prefix}${separator}${msg}${COLORS.reset}`, ...args);
    };
}
