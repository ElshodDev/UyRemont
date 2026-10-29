// =============================================
// UyRemont - Administrator amallari jurnali
// =============================================

const { randomUUID } = require('crypto');
const { query } = require('../config/database');

/**
 * Admin amalini jurnalga yozish. Jurnal xatosi asosiy amalni to'xtatmaydi.
 * @param {import('express').Request} req
 * @param {{ action: string, targetUserId?: string, targetOrderId?: string, details?: object }} entry
 * @param {import('pg').PoolClient} [client] - tranzaksiya ichida yozish uchun
 */
const logAdminAction = async (req, { action, targetUserId = null, targetOrderId = null, details = null }, client) => {
    const run = client ? client.query.bind(client) : query;
    try {
        await run(
            `INSERT INTO admin_audit_log (id, admin_id, action, target_user_id, target_order_id, details, ip)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [randomUUID(), req.user.id, action, targetUserId, targetOrderId, details ? JSON.stringify(details) : null, req.ip]
        );
    } catch (error) {
        if (client) throw error;
        console.error('❌ Admin jurnaliga yozib bo\'lmadi:', error.message);
    }
};

module.exports = { logAdminAction };
