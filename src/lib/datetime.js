// src/lib/datetime.js
// Toda la aplicación muestra fechas y horas en hora de New Jersey (ET).
// La base de datos siempre guarda instantes en UTC.

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'America/New_York';

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function getParts(date, options) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    ...options,
  });

  const parts = {};

  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value;
    }
  }

  return parts;
}

function getDateTimeParts(date) {
  const parts = getParts(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function getDateParts(date) {
  const parts = getParts(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  };
}

function getTimeZoneOffsetMs(date) {
  const parts = getDateTimeParts(date);
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );

  return asUTC - date.getTime();
}

/**
 * Convierte una fecha/hora de pared en ET a un instante UTC.
 */
export function zonedTimeToUtc(year, month, day, hour = 0, minute = 0, second = 0) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  let offset = getTimeZoneOffsetMs(new Date(utcGuess));
  let result = utcGuess - offset;

  // Recalcular por si el primer intento cayó en el otro lado de un cambio de DST.
  offset = getTimeZoneOffsetMs(new Date(result));
  result = utcGuess - offset;

  return new Date(result);
}

/**
 * Convierte "YYYY-MM-DD" + "HH:mm" interpretados en ET a un Date UTC.
 * Devuelve null si la fecha u hora no son válidas.
 */
export function fromZonedInputs(dateValue, timeValue) {
  const dateText = String(dateValue || '').trim();
  const timeText = String(timeValue || '').trim() || '12:00';

  const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeText.match(/^(\d{2}):(\d{2})$/);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);

  if (hour > 23 || minute > 59) {
    return null;
  }

  const calendarCheck = new Date(Date.UTC(year, month - 1, day));

  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day
  ) {
    return null;
  }

  return zonedTimeToUtc(year, month, day, hour, minute, 0);
}

/**
 * Devuelve la fecha y hora ET en strings para los inputs del editor.
 */
export function toZonedDateInputs(value) {
  const date = toDate(value);

  if (!date) {
    return { date: '', time: '' };
  }

  const parts = getDateTimeParts(date);

  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

/**
 * Rango UTC que corresponde a "hoy" en ET.
 */
export function getTodayRangeUtc(now = new Date()) {
  const today = getDateParts(now);
  const start = zonedTimeToUtc(today.year, today.month, today.day, 0, 0, 0);

  const next = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const tomorrowStart = zonedTimeToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
    0,
    0
  );

  return {
    start,
    end: new Date(tomorrowStart.getTime() - 1),
  };
}

export function formatTimelineDateTime(value) {
  const date = toDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('es-US', {
    timeZone: APP_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatShortDateTime(value) {
  const date = toDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('es-US', {
    timeZone: APP_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatFollowUpDateTime(value) {
  const date = toDate(value);
  if (!date) return '';

  const day = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

  return `${day} · ${time}`;
}

export function formatRadiusNoteDate(value = new Date()) {
  const date = toDate(value);
  if (!date) return '';

  return new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}
