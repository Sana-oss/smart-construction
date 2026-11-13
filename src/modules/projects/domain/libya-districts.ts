// Libya's 22 districts (shabiyat), used for the city choice in the project wizard (decision 14 Nov 2026).
// Source: Wikipedia, "Districts of Libya" (checked 14 Nov 2026): 22 districts, the division in force from 2007.
// The article notes this was the first-level division "prior to 2013"; if an official newer list is adopted,
// change it HERE only (with its source). Stored as data: no other code depends on the names.
export const LIBYA_DISTRICTS = [
  'البطنان',
  'درنة',
  'الجبل الأخضر',
  'المرج',
  'بنغازي',
  'الواحات',
  'الكفرة',
  'سرت',
  'مصراتة',
  'المرقب',
  'طرابلس',
  'الجفارة',
  'الزاوية',
  'النقاط الخمس',
  'الجبل الغربي',
  'نالوت',
  'الجفرة',
  'وادي الشاطئ',
  'سبها',
  'وادي الحياة',
  'غات',
  'مرزق',
] as const;

export type LibyaDistrict = (typeof LIBYA_DISTRICTS)[number];

/** The value the form sends when the owner's city is not in the list ("أخرى"). */
export const OTHER_CITY = 'other';
