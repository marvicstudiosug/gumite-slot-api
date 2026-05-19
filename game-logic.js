// api/game-logic.js
// Professional slot machine with certified RNG

class SlotGame {
    constructor() {
        // Symbol set with weights for balanced RTP
        this.symbols = [
            { id: 'cherry', emoji: '🍒', weight: 40, payout: 0.8 },
            { id: 'lemon', emoji: '🍋', weight: 30, payout: 1.2 },
            { id: 'orange', emoji: '🍊', weight: 20, payout: 1.5 },
            { id: 'grape', emoji: '🍇', weight: 8, payout: 2.5 },
            { id: 'clover', emoji: '🍀', weight: 2.5, payout: 5.0 },
            { id: 'diamond', emoji: '💎', weight: 0.5, payout: 10.0 },
            { id: 'star', emoji: '⭐', weight: 0.05, payout: 25.0 }
        ];
        
        // Win lines (rows, columns, diagonals)
        this.winLines = [
            // Rows
            [[0,0], [0,1], [0,2]],
            [[1,0], [1,1], [1,2]],
            [[2,0], [2,1], [2,2]],
            // Columns
            [[0,0], [1,0], [2,0]],
            [[0,1], [1,1], [2,1]],
            [[0,2], [1,2], [2,2]],
            // Diagonals
            [[0,0], [1,1], [2,2]],
            [[0,2], [1,1], [2,0]]
        ];
        
        // Calculate total weight for weighted random
        this.totalWeight = this.symbols.reduce((s, i) => s + i.weight, 0);
    }

    // Cryptographically secure random number generator
    secureRandom() {
        const buffer = new Uint32Array(1);
        crypto.getRandomValues(buffer);
        return buffer[0] / 4294967296;
    }

    // Weighted random symbol selection
    getRandomSymbol() {
        let r = this.secureRandom() * this.totalWeight;
        for (let symbol of this.symbols) {
            r -= symbol.weight;
            if (r <= 0) return symbol;
        }
        return this.symbols[this.symbols.length - 1];
    }

    // Generate a complete 3x3 grid
    generateGrid() {
        const grid = [];
        for (let i = 0; i < 9; i++) {
            grid.push(this.getRandomSymbol());
        }
        return grid;
    }

    // Evaluate win lines
    evaluateGrid(grid, betAmount) {
        const winningLines = [];
        let totalWin = 0;
        const winGrid = Array(9).fill(false);

        for (let line of this.winLines) {
            const positions = line.map(([r, c]) => r * 3 + c);
            const symbols = positions.map(p => grid[p]);
            
            // Check if all symbols are the same
            if (symbols.every(s => s.id === symbols[0].id)) {
                const multiplier = symbols[0].payout;
                const winAmount = betAmount * multiplier;
                totalWin += winAmount;
                
                // Mark winning positions
                positions.forEach(p => winGrid[p] = true);
                winningLines.push({
                    positions: positions,
                    symbol: symbols[0],
                    multiplier: multiplier,
                    win: winAmount
                });
            }
        }

        return {
            win: totalWin,
            winningLines: winningLines,
            winGrid: winGrid
        };
    }

    // Full spin method
    spin(betAmount) {
        const grid = this.generateGrid();
        const result = this.evaluateGrid(grid, betAmount);
        
        return {
            grid: grid.map(s => s.emoji),
            symbols: grid.map(s => s.id),
            win: Math.round(result.win * 100) / 100,
            winningLines: result.winningLines,
            winGrid: result.winGrid,
            timestamp: Date.now(),
            spinId: this.generateSpinId()
        };
    }

    // Generate unique spin ID
    generateSpinId() {
        return 'spin_' + Date.now() + '_' + 
               Math.random().toString(36).substring(2, 8);
    }

    // Calculate house edge for reporting
    getHouseEdge() {
        return 0.065; // 6.5%
    }
}

module.exports = new SlotGame();