import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function numberToArabicWords(number: number): string {
  if (number === 0) return 'صفر ريال سعودي فقط لا غير';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

  let result = '';
  let num = Math.floor(number);

  function convertHundreds(n: number): string {
    if (n === 0) return '';
    let res = '';
    if (n >= 100) {
      res += hundreds[Math.floor(n / 100)];
      n %= 100;
      if (n > 0) res += ' و';
    }
    if (n > 0) {
      if (n < 10) res += ones[n];
      else if (n < 20) res += (n === 10 ? 'عشرة' : ones[n % 10] + ' عشر');
      else {
        const t = Math.floor(n / 10), u = n % 10;
        res += (u > 0 ? ones[u] + ' و' : '') + tens[t];
      }
    }
    return res;
  }

  if (num >= 1000) {
    const t = Math.floor(num / 1000);
    const rem = num % 1000;
    result += (t === 1 ? 'ألف' : t === 2 ? 'ألفان' : convertHundreds(t) + ' ألف');
    if (rem > 0) result += ' و' + convertHundreds(rem);
  } else {
    result = convertHundreds(num);
  }

  return (result || '') + ' ريال سعودي فقط لا غير';
}

export function getWorkDaysSince(d: Date | string): number {
  const start = new Date(d);
  const today = new Date();
  let count = 0;
  const current = new Date(start);
  while (current < today) {
    current.setDate(current.getDate() + 1);
    if (current.getDay() !== 5 && current.getDay() !== 6) count++;
  }
  return count;
}
