import React, { useState, useMemo } from 'react';

/**
 * LotteryUI Component
 * A minimalist, desktop-first interface with the #141414 and #F3F3F3 palette.
 */
const LotteryUI: React.FC = () => {
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  
  // Total tickets count
  const TICKET_COUNT = 1000;
  const ROWS = 10;
  const COLS = 100;

  // Mock data: randomly decide which blocks are "sold"
  const soldTickets = useMemo(() => {
    const sold = new Set<number>();
    // Randomly fill ~30% of the tickets for visualization
    for (let i = 0; i < TICKET_COUNT; i++) {
      if (Math.random() < 0.3) {
        sold.add(i);
      }
    }
    return sold;
  }, []);

  return (
    <div className="min-h-screen flex flex-col p-6 md:p-10 bg-brand-dark text-brand-light">
      
      {/* TOP SECTION: Header & Stats */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-brand-light pb-8 mb-10 gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tighter uppercase">SOL Lottery</h1>
          <div className="flex gap-6 text-xs tracking-widest opacity-60 uppercase">
            <div>Round Ends In: <span className="text-brand-light font-mono">23:59:59</span></div>
            <div>Sold: <span className="text-brand-light font-mono">{soldTickets.size} / 1000</span></div>
            <div>Prize: <span className="text-brand-light font-mono">14.50 SOL</span></div>
          </div>
        </div>

        <button className="px-6 py-2 border border-brand-light text-xs uppercase tracking-widest hover:bg-brand-light hover:text-brand-dark transition-colors">
          Connect Wallet
        </button>
      </header>

      {/* CENTER SECTION: 10x100 Block Grid */}
      <main className="flex-1 flex flex-col items-center justify-center overflow-hidden mb-10">
        <div className="w-full overflow-x-auto pb-6 custom-scrollbar">
          <div 
            className="grid gap-1 min-w-max mx-auto p-2"
            style={{ 
              gridTemplateRows: `repeat(${ROWS}, 12px)`, 
              gridTemplateColumns: `repeat(${COLS}, 12px)` 
            }}
          >
            {Array.from({ length: TICKET_COUNT }).map((_, index) => {
              const isSold = soldTickets.has(index);
              return (
                <div
                  key={index}
                  className={`w-[12px] h-[12px] transition-none ${
                    isSold 
                      ? 'bg-brand-light' 
                      : 'border border-brand-light/30 bg-transparent'
                  }`}
                  title={`Ticket #${index + 1}`}
                />
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex gap-6 text-[10px] uppercase tracking-[0.2em] opacity-50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 border border-brand-light/50"></div> Available
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-brand-light"></div> Sold
          </div>
        </div>
      </main>

      {/* BOTTOM SECTION: Controls */}
      <footer className="border-t border-brand-light pt-10 flex flex-col md:flex-row justify-between items-center gap-8">
        
        {/* Buy Panel */}
        <div className="flex flex-col gap-4 w-full md:w-auto">
          <span className="text-[10px] uppercase tracking-widest opacity-50">Quantity</span>
          <div className="flex border border-brand-light">
            {[1, 3, 5, 10].map((num) => (
              <button
                key={num}
                onClick={() => setSelectedQuantity(num)}
                className={`px-6 py-2 text-sm font-mono transition-none ${
                  selectedQuantity === num ? 'bg-brand-light text-brand-dark' : 'text-brand-light bg-brand-dark'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center md:items-end gap-4 w-full md:w-auto">
          <button 
            disabled 
            className="px-12 py-4 border border-brand-light opacity-30 text-brand-light text-sm font-bold uppercase tracking-[0.3em] cursor-not-allowed w-full md:w-auto"
          >
            Buy {selectedQuantity} Ticket{selectedQuantity > 1 ? 's' : ''}
          </button>
          
          <p className="text-[9px] uppercase tracking-widest opacity-40">
            Wallet required to purchase
          </p>
        </div>

      </footer>
    </div>
  );
};

export default LotteryUI;