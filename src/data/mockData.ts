export interface Holding {
  symbol: string;
  name: string;
  amount: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercentage: number;
}

export const mockHoldings: Holding[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    amount: 0.5242,
    currentPrice: 67450.23,
    value: 35360.94,
    pnl: 4580.12,
    pnlPercentage: 14.87
  },
  {
    symbol: "ETH",
    name: "Ethereum", 
    amount: 8.7543,
    currentPrice: 3245.67,
    value: 28414.28,
    pnl: -1240.56,
    pnlPercentage: -4.18
  },
  {
    symbol: "BNB",
    name: "BNB",
    amount: 45.2341,
    currentPrice: 642.15,
    value: 29034.87,
    pnl: 2456.73,
    pnlPercentage: 9.24
  },
  {
    symbol: "SOL",
    name: "Solana",
    amount: 124.8903,
    currentPrice: 198.34,
    value: 24762.45,
    pnl: 3840.67,
    pnlPercentage: 18.34
  },
  {
    symbol: "ADA",
    name: "Cardano",
    amount: 12456.2341,
    currentPrice: 0.67,
    value: 8345.68,
    pnl: -892.34,
    pnlPercentage: -9.67
  },
  {
    symbol: "AVAX",
    name: "Avalanche",
    amount: 234.5677,
    currentPrice: 42.89,
    value: 10058.37,
    pnl: 1456.23,
    pnlPercentage: 16.92
  }
];

export const calculateTotals = (holdings: Holding[]) => {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);
  const totalPnl = holdings.reduce((sum, holding) => sum + holding.pnl, 0);
  const totalPnlPercentage = (totalPnl / (totalValue - totalPnl)) * 100;
  
  return {
    totalBalance: totalValue,
    totalPnl,
    totalPnlPercentage
  };
};