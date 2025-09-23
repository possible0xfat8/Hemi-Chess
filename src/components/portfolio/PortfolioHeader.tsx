import { Card } from "@/components/ui/card";

interface PortfolioHeaderProps {
  totalBalance: number;
  totalPnl: number;
  totalPnlPercentage: number;
}

export const PortfolioHeader = ({ totalBalance, totalPnl, totalPnlPercentage }: PortfolioHeaderProps) => {
  const isProfit = totalPnl >= 0;
  
  return (
    <Card className="p-8 mb-8 bg-gradient-to-r from-card to-secondary border-border shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary mb-2">Portfolio Overview</h1>
          <div className="flex items-baseline gap-4">
            <span className="text-4xl font-bold text-foreground">
              ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`text-lg font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
              {isProfit ? '+' : ''}${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
        <div className="mt-4 md:mt-0 text-right">
          <div className="text-sm text-muted-foreground mb-1">24h Change</div>
          <div className={`text-2xl font-bold ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {isProfit ? '+' : ''}{totalPnlPercentage.toFixed(2)}%
          </div>
        </div>
      </div>
    </Card>
  );
};