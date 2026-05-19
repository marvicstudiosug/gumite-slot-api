const express = require('express');
const cors = require('cors');
require('dotenv').config();
const path = require('path');

const { createClient } = require('@supabase/supabase-js');

const slotGame = require('./game-logic');
const db = require('./database');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();

app.use(cors());
app.use(express.json());
app.use('/demo', express.static(path.join(__dirname, '../demo')));

async function authenticate(req, res, next) {
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    const company = await db.getCompany(apiKey);
    if (!company) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    req.company = company;
    next();
}

app.get('/api/health', (req, res) => {
    res.json({ status: 'online', version: '1.0.0', timestamp: Date.now() });
});

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

app.get('/api/debug', async (req, res) => {
    try {
        const company = await db.getCompany('test_api_key_123');
        res.json({
            supabase_url: process.env.SUPABASE_URL ? 'set' : 'missing',
            supabase_key: process.env.SUPABASE_ANON_KEY ? 'set' : 'missing',
            company_found: company ? true : false,
            company_data: company
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

app.get('/api/direct-query', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('api_key', 'test_api_key_123');
        if (error) {
            return res.json({ success: false, error: error.message });
        }
        res.json({ 
            success: true, 
            data: data,
            count: data.length,
            found: data.length > 0
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/spin', authenticate, async (req, res) => {
    try {
        const { playerId, betAmount } = req.body;
        if (!playerId) return res.status(400).json({ error: 'Player ID required' });
        if (!betAmount || betAmount < 10) return res.status(400).json({ error: 'Minimum bet is 10 UGX' });
        if (betAmount > 10000) return res.status(400).json({ error: 'Maximum bet is 10,000 UGX' });
        if (req.company.balance < betAmount) {
            return res.status(402).json({ error: 'Insufficient balance' });
        }
        const result = slotGame.spin(betAmount);
        const newBalance = req.company.balance - betAmount + result.win;
        await db.updateCompanyBalance(req.company.id, newBalance);
        await db.logSpin(req.company.id, playerId, betAmount, result.win, result.grid.join(','));
        res.json({
            success: true,
            spinId: result.spinId,
            grid: result.grid,
            win: result.win,
            balance: { company: newBalance, player: null },
            timestamp: result.timestamp
        });
    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/deposit', authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount < 1000) {
            return res.status(400).json({ error: 'Minimum deposit is 1,000 UGX' });
        }
        const newBalance = req.company.balance + amount;
        await db.updateCompanyBalance(req.company.id, newBalance);
        await db.logTransaction(req.company.id, 'deposit', amount, 'DEP_' + Date.now());
        res.json({ success: true, transactionId: 'DEP_' + Date.now(), newBalance });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/withdraw', authenticate, async (req, res) => {
    try {
        const { amount, bankAccount } = req.body;
        if (!amount || amount < 1000) {
            return res.status(400).json({ error: 'Minimum withdrawal is 1,000 UGX' });
        }
        if (req.company.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }
        if (!bankAccount) {
            return res.status(400).json({ error: 'Bank account required' });
        }
        const newBalance = req.company.balance - amount;
        await db.updateCompanyBalance(req.company.id, newBalance);
        await db.logTransaction(req.company.id, 'withdrawal', -amount, 'WITHDRAW_' + Date.now());
        res.json({ success: true, transactionId: 'WITHDRAW_' + Date.now(), newBalance });
    } catch (error) {
        console.error('Withdrawal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/balance', authenticate, async (req, res) => {
    res.json({
        companyId: req.company.id,
        companyName: req.company.name,
        balance: req.company.balance,
        currency: 'UGX',
        timestamp: Date.now()
    });
});

app.get('/api/stats', authenticate, async (req, res) => {
    try {
        const stats = await db.getCompanyStats(req.company.id);
        res.json({
            companyId: req.company.id,
            companyName: req.company.name,
            ...stats,
            currency: 'UGX'
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/admin/companies', async (req, res) => {
    try {
        const companies = await db.getAllCompanies();
        res.json({ success: true, companies: companies });
    } catch (error) {
        console.error('Admin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 GUMITE Slot API running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`💰 House edge: ${slotGame.getHouseEdge() * 100}%`);
});
