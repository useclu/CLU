import {
  GAME_DEFAULT_START_DATE,
} from './game'

const DAY_LABELS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
]

const MONTH_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

export function dateForGameDay(
  day: number,
  startDate = GAME_DEFAULT_START_DATE,
) {
  const normalizedDay = Math.max(1, Math.floor(day || 1))
  const date = new Date(`${startDate}T12:00:00`)
  date.setDate(date.getDate() + normalizedDay - 1)
  return date
}

export function isoDateForGameDay(
  day: number,
  startDate = GAME_DEFAULT_START_DATE,
) {
  const date = dateForGameDay(day, startDate)
  return [
    date.getFullYear().toString().padStart(4, '0'),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getDate().toString().padStart(2, '0'),
  ].join('-')
}

export function gameDayLabel(
  day: number,
  startDate = GAME_DEFAULT_START_DATE,
) {
  const date = dateForGameDay(day, startDate)

  return `${DAY_LABELS[date.getDay()]} — Jour ${Math.max(1, Math.floor(day || 1))} — ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`
}


export function gameCalendarHeaderLabel(
  day: number,
  startDate = GAME_DEFAULT_START_DATE,
) {
  const date = dateForGameDay(day, startDate)
  return `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`
}

export function gameDayWeekdayIndex(
  day: number,
  startDate = GAME_DEFAULT_START_DATE,
) {
  return dateForGameDay(day, startDate).getDay()
}

export function isGameWeekend(
  day: number,
  startDate = GAME_DEFAULT_START_DATE,
) {
  const weekday = gameDayWeekdayIndex(day, startDate)
  return weekday === 0 || weekday === 6
}
