/**
 * Input Normalizer - Converts JSON-style test case inputs into
 * standard competitive programming stdin format.
 *
 * Examples:
 *   "[1,2,3,4]"        → "4\n1 2 3 4"
 *   "[1,2,3]\n9"        → "3\n1 2 3\n9"
 *   "hello"             → "hello"
 *   "5"                 → "5"
 *   "[[1,2],[3,4]]"     → "2\n2\n1 2\n2\n3 4"
 */

/**
 * Normalize a single value that might be a JSON array or a plain value.
 * Returns an array of lines.
 */
function normalizeSingleValue(val) {
    const trimmed = val.trim();

    // Try to parse as JSON
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        // Not JSON — return as-is (plain string, number, etc.)
        return [trimmed];
    }

    // If it's an array, convert to CP format
    if (Array.isArray(parsed)) {
        return flattenArray(parsed);
    }

    // If it's a number or boolean or other primitive, just stringify it
    return [String(parsed)];
}

/**
 * Flatten an array into CP-style lines.
 * For a 1D array: size on first line, elements space-separated on second line.
 * For a 2D array: number of rows, then each row as: size, elements.
 */
function flattenArray(arr) {
    if (arr.length === 0) {
        return ["0"];
    }

    // Check if it's a 2D array (array of arrays)
    if (Array.isArray(arr[0])) {
        const lines = [String(arr.length)];
        for (const subArr of arr) {
            lines.push(String(subArr.length));
            lines.push(subArr.join(" "));
        }
        return lines;
    }

    // 1D array: size + elements
    return [String(arr.length), arr.join(" ")];
}

/**
 * Main normalizer function.
 * Takes a raw test case input string and converts it to clean stdin.
 *
 * Strategy:
 * 1. Split by newlines.
 * 2. For each line, check if it's a JSON array — if so, expand it.
 * 3. Otherwise, pass through as-is.
 */
export function normalizeInput(raw) {
    if (raw === null || raw === undefined) return "";

    const rawStr = String(raw).trim();
    if (rawStr === "") return "";

    // Split the input by newlines (handles both \n and actual newlines)
    const lines = rawStr.split(/\n/);
    const outputLines = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine === "") continue; // skip blank lines

        const expanded = normalizeSingleValue(trimmedLine);
        outputLines.push(...expanded);
    }

    return outputLines.join("\n");
}
