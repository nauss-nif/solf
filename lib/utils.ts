import { twMerge } from 'tailwind-merge'

type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean>
  | ClassValue[]

function toClassName(input: ClassValue): string {
  if (!input) return ''

  if (typeof input === 'string' || typeof input === 'number') {
    return String(input)
  }

  if (Array.isArray(input)) {
    return input.map(toClassName).filter(Boolean).join(' ')
  }

  return Object.entries(input)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(' ')
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(inputs.map(toClassName).filter(Boolean).join(' '))
}

export function numberToArabicWords(number: number): string {
  if (number === 0) return 'صفر ريال سعودي فقط لاغير';
  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
  const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  
  let result = '';
  let num = Math.floor(number);

  function convertHundreds(n: number): string {
    if (n === 0) return '';
    let res = '';
    if (n >= 100) { res += hundreds[Math.floor(n / 100)]; n %= 100; if (n > 0) res += ' و'; }
    if (n > 0) {
      if (n < 10) res += ones[n];
      else if (n < 20) { if (n === 10) res += 'عشرة'; else res += ones[n % 10] + ' عشر'; }
      else { const t = Math.floor(n / 10), u = n % 10; res += (u > 0 ? ones[u] + ' و' : '') + tens[t]; }
    }
    return res;
  }

  if (num >= 1000) {
    const t = Math.floor(num / 1000); const rem = num % 1000;
    result += (t === 1 ? 'ألف' : t === 2 ? 'ألفان' : convertHundreds(t) + ' ألف');
    if (rem > 0) result += ' و' + convertHundreds(rem);
  } else {
    result = convertHundreds(num);
  }
  
  return (result || '') + ' ريال سعودي فقط لاغير';
}
