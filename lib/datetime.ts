export type DateLike = Date | string | number | null | undefined;

export function toIsoString(value: DateLike) {
  if (value == null) return null;

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();

  return Number.isFinite(time) ? date.toISOString() : null;
}

export type ClockTime = {
  hours: number;
  minutes: number;
};

export type DailyWindowConfig = {
  timeZone: string;
  at: ClockTime;
  windowMinutes: number;
};

export function parseClockTime(value: string): ClockTime {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid clock time "${value}". Expected HH:mm.`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid clock time "${value}". Expected HH:mm within 00:00-23:59.`);
  }

  return { hours, minutes };
}

export function formatClockTime(value: ClockTime) {
  return `${value.hours.toString().padStart(2, "0")}:${value.minutes
    .toString()
    .padStart(2, "0")}`;
}

export function clockTimeToMinutes(value: ClockTime) {
  return value.hours * 60 + value.minutes;
}

export function getScheduleLocalDate(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getScheduleLocalMinutes(timeZone: string, now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour === "24" ? "0" : values.hour);
  const minute = Number(values.minute);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    throw new Error(`Could not resolve local time for ${timeZone}.`);
  }

  return hour * 60 + minute;
}

export function isWithinDailyDigestWindow(now: Date, config: DailyWindowConfig) {
  const localMinutes = getScheduleLocalMinutes(config.timeZone, now);
  const start = clockTimeToMinutes(config.at);
  return localMinutes >= start && localMinutes < start + config.windowMinutes;
}
