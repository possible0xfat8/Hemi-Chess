import { Card } from "@/components/ui/card";

interface Holding {
  symbol: string;
  name: string;
  amount: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercentage: number;
  icon?: string;
}

interface HoldingCardProps {
  holding: Holding;
}

export const HoldingCard = ({ holding }: HoldingCardProps) => {
  const isProfit = holding.pnl >= 0;
  
  return (
    <Card className="p-6 bg-card border-border hover:bg-secondary/50 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="font-bold text-primary text-lg">
              {holding.symbol.slice(0, 2)}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{holding.symbol}</h3>
            <p className="text-sm text-muted-foreground">{holding.name}</p>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-lg font-semibold text-foreground">
            ${holding.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-muted-foreground">
            {holding.amount.toFixed(6)} {holding.symbol}
          </div>
        </div>
        
        <div className="text-right ml-6">
          <div className="text-lg font-semibold text-foreground">
            ${holding.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-sm font-medium ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{holding.pnlPercentage.toFixed(2)}%
          </div>
        </div>
      </div>
    </Card>
  );
};