export const currentQuarter = (date = new Date()) => Math.floor(date.getMonth() / 3) + 1;
