import { norm, lower, noSpace } from './text.ts';

const DAY_ALIASES: Record<string, string> = Object.freeze({
  дүйшөмбү: 'Понедельник',
  дүйшембу: 'Понедельник',
  дуйшембу: 'Понедельник',
  шейшемби: 'Вторник',
  шаршемби: 'Среда',
  бейшемби: 'Четверг',
  жума: 'Пятница',
  ишемби: 'Суббота',
  жекшемби: 'Воскресенье',
  понедельник: 'Понедельник',
  вторник: 'Вторник',
  среда: 'Среда',
  четверг: 'Четверг',
  пятница: 'Пятница',
  суббота: 'Суббота',
  воскресенье: 'Воскресенье',
  пн: 'Понедельник',
  вт: 'Вторник',
  ср: 'Среда',
  чт: 'Четверг',
  пт: 'Пятница',
  сб: 'Суббота',
  вс: 'Воскресенье',
  mon: 'Понедельник',
  monday: 'Понедельник',
  tue: 'Вторник',
  tuesday: 'Вторник',
  wed: 'Среда',
  wednesday: 'Среда',
  thu: 'Четверг',
  thursday: 'Четверг',
  fri: 'Пятница',
  friday: 'Пятница',
  sat: 'Суббота',
  saturday: 'Суббота',
  sun: 'Воскресенье',
  sunday: 'Воскресенье',
});

export function detectDay(raw: unknown): string {
  const v = norm(raw);
  if (!v) return '';
  const keyNoSpace = noSpace(v);
  if (keyNoSpace in DAY_ALIASES) return DAY_ALIASES[keyNoSpace];
  const keyLower = lower(v);
  if (keyLower in DAY_ALIASES) return DAY_ALIASES[keyLower];
  for (const key of Object.keys(DAY_ALIASES)) {
    if (keyLower.includes(key)) return DAY_ALIASES[key];
  }
  return '';
}
