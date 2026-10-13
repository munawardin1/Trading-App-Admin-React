export type SignalType = 'CRYPTO' | 'FOREX' | 'GOLD' | 'STOCKS';
export type Direction = 'LONG' | 'SHORT';
export type SubscriptionValue = 'spot-free' | 'spot-paid' | 'future-free' | 'future-paid';

export interface Signal {
  _id: string;
  coin?: string;
  type: SignalType;
  createdBy: string;
  direction: Direction;
  portfolioPercentage: number;
  entryPrice: number;
  exitPrice: number;
  gainLossPercentage: number;
  createdAt: string;
  expireAt: string;
  expired: boolean;
  isLive: boolean;
  isDeleted: boolean;
  hasTradingAnalysis: boolean;
  tradingAnalysis?: string | boolean;
  subscriptionValue: SubscriptionValue;
}

/** Body accepted by POST /signals/admin/create and PUT /signals/admin/update/:id */
export interface SignalInput {
  coin?: string;
  type: SignalType;
  createdBy: string;
  direction: Direction;
  portfolioPercentage: number;
  entryPrice: number;
  exitPrice: number;
  gainLossPercentage: number;
  expireAt: string;
  isLive: boolean;
  hasTradingAnalysis: boolean;
  tradingAnalysis?: string;
  subscriptionValue: SubscriptionValue;
}

export type NewsContentType = 'crypto' | 'stocks' | 'gold';

export interface NewsAlert {
  _id: string;
  title: string;
  description: string;
  type: 'video' | 'images';
  contentType: NewsContentType;
  isLive: boolean;
  isDeleted: boolean;
  createdBy: string;
  rawAwsLinkVideo?: string;
  rawAwsLinkImages?: string[];
  processingStatus?: string;
  likes?: number;
  comments?: number;
  createdAt: string;
}

export const SUBSCRIPTION_LABELS: Record<SubscriptionValue, string> = {
  'spot-free': 'Spot · Free',
  'spot-paid': 'Spot · Paid',
  'future-free': 'Futures · Free',
  'future-paid': 'Futures · Paid',
};

/** Plan label for a signal: forex and gold have no spot/futures split. */
export function planLabel(type: SignalType, plan: SubscriptionValue): string {
  if (type === 'CRYPTO') return SUBSCRIPTION_LABELS[plan] ?? plan;
  return plan.endsWith('paid') ? 'Paid' : 'Free';
}

/** Display symbol: EURUSD -> EUR/USD, XAUUSD (or none) -> XAU/USD, crypto unchanged. */
export function displaySymbol(type: SignalType, coin?: string): string {
  const c = (coin ?? '').toUpperCase();
  if (type === 'GOLD') return c ? `${c.replace(/USDT?$/, '')}/USD` : 'XAU/USD';
  if (type === 'FOREX' && c.length === 6) return `${c.slice(0, 3)}/${c.slice(3)}`;
  return c || '—';
}
