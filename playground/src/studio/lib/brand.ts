export const BRAND = {
  name: 'NexVora PDF Studio',
  short: 'NexVora',
  version: '1.0.0',
  developer: 'Prince AR Abdur Rahman',
  organization: "NexVora Lab's Ofc",
  cyan: '#22D3EE',
  violet: '#8B5CF6',
  background: '#090D1B',
  surface: '#111827',
  copyright: "© 2026 NexVora Lab's Ofc. All Rights Reserved.",
  contacts: {
    whatsapp: ['01707424006', '01796951709'],
    facebook: 'https://www.facebook.com/share/1BNn32qoJo/',
    instagram: 'https://www.instagram.com/ur___abdur____rahman__',
    gmail: 'prince.ar.abdur.rahman2008@gmail.com',
  },
} as const;

export const CATEGORIES = [
  'Business Documents',
  'Education',
  'Personal Documents',
  'Certificates',
  'Invoices',
  'ID Cards',
  'Forms',
  'Custom Templates',
] as const;
export type Category = (typeof CATEGORIES)[number];
