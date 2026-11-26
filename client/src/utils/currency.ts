export type CurrencyCode = 'USD' | 'INR' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';

export interface CurrencyOption {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
];

export const isSupportedCurrency = (value: string | null): value is CurrencyCode => {
  return CURRENCIES.some((c) => c.code === value);
};

export const getCurrencySymbol = (code: CurrencyCode = 'USD'): string => {
  return CURRENCIES.find((c) => c.code === code)?.symbol || '$';
};

export const formatCurrency = (
  amount: number,
  code: CurrencyCode = 'USD',
  decimals?: number
): string => {
  const symbol = getCurrencySymbol(code);
  const resolvedDecimals =
    code === 'JPY' ? 0 : decimals !== undefined ? decimals : Number.isInteger(amount) ? 0 : 2;
  return `${symbol}${amount.toFixed(resolvedDecimals)}`;
};
