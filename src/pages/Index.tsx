import { PortfolioHeader } from "@/components/portfolio/PortfolioHeader";
import { HoldingCard } from "@/components/portfolio/HoldingCard";
import { mockHoldings, calculateTotals } from "@/data/mockData";

const Index = () => {
  const { totalBalance, totalPnl, totalPnlPercentage } = calculateTotals(mockHoldings);
  
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <PortfolioHeader 
          totalBalance={totalBalance}
          totalPnl={totalPnl}
          totalPnlPercentage={totalPnlPercentage}
        />
        
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-4">Your Holdings</h2>
          <div className="grid gap-4">
            {mockHoldings.map((holding) => (
              <HoldingCard key={holding.symbol} holding={holding} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
