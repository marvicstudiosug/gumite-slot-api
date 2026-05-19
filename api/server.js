const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const slotGame = require('./game-logic');
const db = require('./database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the demo folder
app.use('/demo', express.static(path.join(__dirname, '../demo')));

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

// Debug endpoint to check Supabase connection
app.get('/api/debug', async (req, res) => {
    try {
        const company = await db.getCompany('test_api_key_123');
        res.json({
            supabase_url: process.env.SUPABASE_URL ? 'set' : 'missing',
            supabase_key: process.env.SUPABASE_ANON_KEY ? 'set' : 'missing',
            company_found: company ? true : false,
            company_data: company,
            message: 'Debug info'
        });
    } catch (error) {
        res.json({
            error: error.message,
            supabase_url: process.env.SUPABASE_URL ? 'set' : 'missing',
            supabase_key: process.env.SUPABASE_ANON_KEY ? 'set' : 'missing',
            company_found: false
        });
    }
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