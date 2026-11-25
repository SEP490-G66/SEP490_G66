import { money } from "@/components/reception/receptionUtils";
import { CASHIER_TEXT as TEXT } from "@/utils/messages";

// "2026-11-22T09:30" -> "22/11/2026 09:30"
export const dateTimeText = (value) => {
    if (!value) return TEXT.DASH;
    const [date, time] = value.split("T");
    return `${date.split("-").reverse().join("/")}${time ? ` ${time.slice(0, 5)}` : ""}`;
};

// Error of one line of the receipt: nothing typed, or more than it may take now
export const lineError = (line) => (line.amount <= 0 ? TEXT.AMOUNT_REQUIRED : line.amount > line.ceiling ? TEXT.AMOUNT_OVER(money(line.ceiling)) : null);
