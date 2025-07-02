import { JsonObject } from "@prisma/client/runtime/library";

export function parse(text: string, values: JsonObject | null | undefined, startDelimeter = "{{", endDelimeter = "}}"): string { // <-- CHANGED DELIMITERS HERE
    if (!text || !values) {
        return text; // Return original text if no text or no values to parse from
    }

    let finalString = "";
    let currentIndex = 0;

    while (currentIndex < text.length) {
        const startDelimiterIndex = text.indexOf(startDelimeter, currentIndex);

        if (startDelimiterIndex === -1) {
            // No more delimiters found, append the rest of the text
            finalString += text.substring(currentIndex);
            break;
        }

        // Append text before the current delimiter
        finalString += text.substring(currentIndex, startDelimiterIndex);

        const endDelimiterIndex = text.indexOf(endDelimeter, startDelimiterIndex + startDelimeter.length);

        if (endDelimiterIndex === -1) {
            // Unmatched start delimiter, append the rest of the text and break
            finalString += text.substring(startDelimiterIndex);
            break;
        }

        // Extract the key path, e.g., "comment.amount"
        const keyPath = text.substring(startDelimiterIndex + startDelimeter.length, endDelimiterIndex);
        const keys = keyPath.split(".");

        let resolvedValue: any = values; // Start resolution from the root of the provided values

        let found = true;
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            if (resolvedValue && typeof resolvedValue === 'object' && resolvedValue.hasOwnProperty(key)) {
                resolvedValue = resolvedValue[key];
            } else {
                found = false;
                break;
            }
        }

        if (found && resolvedValue !== undefined && resolvedValue !== null) {
            finalString += String(resolvedValue); // Append the resolved value
        } else {
            // If key not found or path is invalid, append the original placeholder
            finalString += startDelimeter + keyPath + endDelimeter;
        }

        // Move current index past the end delimiter
        currentIndex = endDelimiterIndex + endDelimeter.length;
    }

    return finalString;
}