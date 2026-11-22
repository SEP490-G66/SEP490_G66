const pad = (n) => String(n).padStart(2, "0");

const toKey = (date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

const fromKey = (key) => new Date(`${key}T00:00:00Z`);

export const addDays = (key, n) => {
    const date = fromKey(key);
    date.setUTCDate(date.getUTCDate() + n);
    return toKey(date);
};

export const weekdayIndex = (key) => (fromKey(key).getUTCDay() + 6) % 7;

export const mondayOf = (key) => addDays(key, -weekdayIndex(key));

export const ddmm = (key) => (key ? `${key.slice(8, 10)}/${key.slice(5, 7)}` : "");

export const dmy = (key) => (key ? `${ddmm(key)}/${key.slice(0, 4)}` : "");

export const hhmm = (time) => (time ? String(time).slice(0, 5) : "");

export const toMinutes = (time) => Number(hhmm(time).slice(0, 2)) * 60 + Number(hhmm(time).slice(3, 5));

export const fromMinutes = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const slotEnd = (start, minutes = 30) => fromMinutes(toMinutes(start) + minutes);
