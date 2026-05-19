const express = require('express');
const cors = require('cors');
require('dotenv').config();

const slotGame = require('./game-logic');
const db = require('./database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Authentication middleware
async function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    
    if (!apiKey) {
        return res.status(401).json({ 
            error: 'API key required',
            code: 'MISSING_API_KEY'
        });
    }

    const company = await db.getCompany(apiKey);
    if (!company) {
        return res.status(401).json({ 
            error: 'Invalid API key',
            code: 'INVALID_API_KEY'
        });
    }

    req.company = company;
    next();
}

// ============ PUBLIC ENDPOINTS ============

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'online',
        version: '1.0.0',
        timestamp: Date.now()
    });
});

// Game info
app.get('/api/info', (req, res) => {
    res.json({
        name: 'GUMITE Slot',
        version: '1.0.0',
        symbols: slotGame.symbols.map(s => ({
            emoji: s.emoji,
            payout: s.payout
        })),
        houseEdge: slotGame.getHouseEdge(),
        winLines: slotGame.winLines.length
    });
});

// Demo page
app.get('/demo', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>GUMITE Slot · Demo</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Inter', system-ui, sans-serif;
                    background: #0a0612;
                    color: #fff;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 1rem;
                }
                .demo-container {
                    max-width: 500px;
                    width: 100%;
                    text-align: center;
                }
                .header h1 {
                    font-size: 2.5rem;
                    background: linear-gradient(135deg, #ffdd44, #ff8800);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    margin-bottom: 1rem;
                }
                .slot-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.5rem;
                    margin: 1rem 0;
                }
                .cell {
                    aspect-ratio: 1;
                    background: radial-gradient(circle at 30% 30%, #fff8e7, #dfc9a0);
                    border-radius: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 3rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    transition: 0.2s;
                }
                .cell.win {
                    box-shadow: 0 0 30px #ffdd44;
                    transform: scale(1.05);
                }
                .controls {
                    display: flex;
                    gap: 0.5rem;
                    margin: 1rem 0;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                .btn {
                    padding: 0.8rem 2rem;
                    border: none;
                    border-radius: 0.5rem;
                    font-size: 1rem;
                    font-weight: bold;
                    cursor: pointer;
                    transition: 0.2s;
                    background: linear-gradient(135deg, #ffdd44, #ff8800);
                    color: #1a1205;
                }
                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .btn:hover:not(:disabled) {
                    transform: scale(1.02);
                }
                .bet-input {
                    padding: 0.8rem;
                    border-radius: 0.5rem;
                    border: 1px solid #ffdd44;
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                    font-size: 1rem;
                    width: 100px;
                    text-align: center;
                }
                .result {
                    font-size: 1.2rem;
                    margin: 1rem 0;
                    padding: 0.5rem;
                    border-radius: 0.5rem;
                    background: rgba(255,255,255,0.05);
                }
                .result.win {
                    background: rgba(255,220,68,0.2);
                    border: 1px solid #ffdd44;
                }
                .balance-display {
                    margin: 1rem 0;
                    padding: 0.5rem;
                    background: rgba(255,255,255,0.05);
                    border-radius: 0.5rem;
                }
                .balance-display span {
                    font-weight: bold;
                    color: #ffdd44;
                }
                @media (max-width: 400px) {
                    .cell { font-size: 2rem; }
                }
            </style>
        </head>
        <body>
            <div class="demo-container">
                <div class="header">
                    <h1>🎰 GUMITE</h1>
                    <p>Professional Slot API · Demo</p>
                </div>
                <div class="balance-display">
                    💰 Balance: <span id="balance">10,000</span> UGX
                </div>
                <div class="slot-grid" id="slotGrid">
                    <div class="cell">🍒</div>
                    <div class="cell">🍋</div>
                    <div class="cell">🍊</div>
                    <div class="cell">🍇</div>
                    <div class="cell">🍀</div>
                    <div class="cell">💎</div>
                    <div class="cell">⭐</div>
                    <div class="cell">🍒</div>
                    <div class="cell">🍋</div>
                </div>
                <div class="controls">
                    <input type="number" class="bet-input" id="betAmount" value="500" min="10" max="10000">
                    <button class="btn" id="spinBtn">🎰 SPIN</button>
                </div>
                <div class="result" id="result">Press SPIN to start</div>
            </div>
            <script>
                const API_URL = 'https://gumite-slot-api.onrender.com/api';
                let balance = 10000;
                let spinning = false;
                const gridEl = document.getElementById('slotGrid');
                const spinBtn = document.getElementById('spinBtn');
                const betInput = document.getElementById('betAmount');
                const resultEl = document.getElementById('result');
                const balanceEl = document.getElementById('balance');

                function updateBalance() {
                    balanceEl.textContent = balance.toLocaleString();
                }

                function renderGrid(grid) {
                    const cells = gridEl.querySelectorAll('.cell');
                    cells.forEach((cell, i) => {
                        cell.textContent = grid[i] || '🍒';
                        cell.classList.remove('win');
                    });
                }

                async function spin() {
                    if (spinning) return;
                    const betAmount = parseInt(betInput.value);
                    if (isNaN(betAmount) || betAmount < 10) {
                        alert('Minimum bet is 10 UGX');
                        return;
                    }
                    if (betAmount > balance) {
                        alert('Insufficient balance');
                        return;
                    }
                    spinning = true;
                    spinBtn.disabled = true;
                    resultEl.textContent = '🎡 Spinning...';
                    resultEl.className = 'result';
                    balance -= betAmount;
                    updateBalance();
                    try {
                        const response = await fetch(`${API_URL}/spin`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                playerId: 'demo_player_1',
                                betAmount: betAmount
                            })
                        });
                        const data = await response.json();
                        if (data.success) {
                            renderGrid(data.grid);
                            if (data.win > 0) {
                                balance += data.win;
                                resultEl.textContent = `🎉 You won ${data.win.toLocaleString()} UGX!`;
                                resultEl.className = 'result win';
                            } else {
                                resultEl.textContent = '💨 No win. Try again!';
                                resultEl.className = 'result';
                            }
                            updateBalance();
                        } else {
                            resultEl.textContent = `Error: ${data.error}`;
                            resultEl.className = 'result';
                            balance += betAmount;
                            updateBalance();
                        }
                    } catch (error) {
                        resultEl.textContent = '⚠️ Connection error. Make sure API is running.';
                        resultEl.className = 'result';
                        balance += betAmount;
                        updateBalance();
                    }
                    spinning = false;
                    spinBtn.disabled = false;
                }
                spinBtn.addEventListener('click', spin);
                updateBalance();
            </script>
        </body>
        </html>
    `);
});

// ============ PROTECTED ENDPOINTS ============

// Spin endpoint
app.post('/api/spin', authenticate, async (req, res) => {
    try {
        const { playerId, betAmount } = req.body;
        
        if (!playerId) {
            return res.status(400).json({ 
                error: 'Player ID required',
                code: 'MISSING_PLAYER_ID'
            });
        }

        if (!betAmount || betAmount < 10) {
            return res.status(400).json({ 
                error: 'Minimum bet is 10 UGX',
                code: 'INVALID_BET'
            });
        }

        if (betAmount > 10000) {
            return res.status(400).json({ 
                error: 'Maximum bet is 10,000 UGX',
                code: 'INVALID_BET'
            });
        }

        if (req.company.balance < betAmount) {
            return res.status(402).json({ 
                error: 'Insufficient balance. Please deposit funds.',
                code: 'INSUFFICIENT_BALANCE',
                balance: req.company.balance,
                required: betAmount
            });
        }

        const result = slotGame.spin(betAmount);
        
        const newBalance = req.company.balance - betAmount + result.win;
        await db.updateCompanyBalance(req.company.id, newBalance);
        
        await db.logSpin(
            req.company.id,
            playerId,
            betAmount,
            result.win,
            result.grid.join(',')
        );

        res.json({
            success: true,
            spinId: result.spinId,
            grid: result.grid,
            win: result.win,
            winningLines: result.winningLines.map(line => ({
                positions: line.positions,
                multiplier: line.multiplier,
                win: line.win
            })),
            balance: {
                company: newBalance,
                player: null
            },
            timestamp: result.timestamp
        });

    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Deposit endpoint
app.post('/api/deposit', authenticate, async (req, res) => {
    try {
        const { amount, reference } = req.body;

        if (!amount || amount < 1000) {
            return res.status(400).json({ 
                error: 'Minimum deposit is 1,000 UGX',
                code: 'INVALID_AMOUNT'
            });
        }

        const newBalance = req.company.balance + amount;
        await db.updateCompanyBalance(req.company.id, newBalance);
        
        await db.logTransaction(
            req.company.id,
            'deposit',
            amount,
            reference || 'DEP_' + Date.now()
        );

        res.json({
            success: true,
            transactionId: 'DEP_' + Date.now(),
            amount: amount,
            newBalance: newBalance,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Withdrawal endpoint
app.post('/api/withdraw', authenticate, async (req, res) => {
    try {
        const { amount, bankAccount, reference } = req.body;

        if (!amount || amount < 1000) {
            return res.status(400).json({ 
                error: 'Minimum withdrawal is 1,000 UGX',
                code: 'INVALID_AMOUNT'
            });
        }

        if (req.company.balance < amount) {
            return res.status(400).json({ 
                error: 'Insufficient balance',
                code: 'INSUFFICIENT_BALANCE',
                balance: req.company.balance,
                required: amount
            });
        }

        if (!bankAccount) {
            return res.status(400).json({ 
                error: 'Bank account required',
                code: 'MISSING_BANK_ACCOUNT'
            });
        }

        const newBalance = req.company.balance - amount;
        await db.updateCompanyBalance(req.company.id, newBalance);
        
        await db.logTransaction(
            req.company.id,
            'withdrawal',
            -amount,
            reference || 'WITHDRAW_' + Date.now()
        );

        console.log(`Withdrawal: ${req.company.name} withdrew ${amount} UGX to ${bankAccount}`);

        res.json({
            success: true,
            transactionId: 'WITHDRAW_' + Date.now(),
            amount: amount,
            newBalance: newBalance,
            bankAccount: bankAccount,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Balance check
app.get('/api/balance', authenticate, async (req, res) => {
    res.json({
        companyId: req.company.id,
        companyName: req.company.name,
        balance: req.company.balance,
        currency: 'UGX',
        timestamp: Date.now()
    });
});

// Statistics
app.get('/api/stats', authenticate, async (req, res) => {
    try {
        const stats = await db.getCompanyStats(req.company.id);
        
        res.json({
            companyId: req.company.id,
            companyName: req.company.name,
            ...stats,
            currency: 'UGX',
            period: 'all_time',
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// Admin endpoint to get all companies
app.get('/api/admin/companies', async (req, res) => {
    try {
        const companies = await db.getAllCompanies();
        res.json({
            success: true,
            companies: companies
        });
    } catch (error) {
        console.error('Admin companies error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

// ============ ERROR HANDLING ============
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        code: 'SERVER_ERROR'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        code: 'NOT_FOUND'
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 GUMITE Slot API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💰 House edge: ${slotGame.getHouseEdge() * 100}%`);
});
