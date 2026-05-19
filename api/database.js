// api/database.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

class Database {
    async getCompany(apiKey) {
        console.log('🔍 Looking for API key:', apiKey);
        
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .eq('api_key', apiKey)
            .single();
        
        if (error) {
            console.log('❌ Supabase error:', error.message);
            return null;
        }
        
        console.log('✅ Found company:', data);
        return data;
    }

    async updateCompanyBalance(companyId, newBalance) {
        const { data, error } = await supabase
            .from('companies')
            .update({ balance: newBalance })
            .eq('id', companyId)
            .select();
        
        if (error) throw error;
        return data;
    }

    async logSpin(companyId, playerId, betAmount, winAmount, grid) {
        const { data, error } = await supabase
            .from('spins')
            .insert([{
                company_id: companyId,
                player_id: playerId,
                bet_amount: betAmount,
                win_amount: winAmount,
                grid: grid,
                timestamp: new Date()
            }]);
        
        if (error) throw error;
        return data;
    }

    async logTransaction(companyId, type, amount, reference) {
        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                company_id: companyId,
                type: type,
                amount: amount,
                reference: reference,
                timestamp: new Date()
            }]);
        
        if (error) throw error;
        return data;
    }

    async getCompanyStats(companyId) {
        const { data: spins, error: spinsError } = await supabase
            .from('spins')
            .select('*')
            .eq('company_id', companyId);
        
        if (spinsError) throw spinsError;
        
        const totalSpins = spins.length;
        const totalBets = spins.reduce((s, i) => s + i.bet_amount, 0);
        const totalWins = spins.reduce((s, i) => s + i.win_amount, 0);
        const winCount = spins.filter(s => s.win_amount > 0).length;
        
        return {
            totalSpins,
            totalBets,
            totalWins,
            winRate: totalSpins > 0 ? (winCount / totalSpins) * 100 : 0,
            profit: totalBets - totalWins,
            houseEdge: totalBets > 0 ? ((totalBets - totalWins) / totalBets) * 100 : 0
        };
    }

    async getAllCompanies() {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }
}

module.exports = new Database();= spins.filter(s => s.win_amount > 0).length;
        
        return {
            totalSpins,
            totalBets,
            totalWins,
            winRate: totalSpins > 0 ? (winCount / totalSpins) * 100 : 0,
            profit: totalBets - totalWins,
            houseEdge: totalBets > 0 ? ((totalBets - totalWins) / totalBets) * 100 : 0
        };
    }

    async getAllCompanies() {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }
}

console.log('✅ DATABASE.JS LOADED SUCCESSFULLY');

module.exports = new Database();