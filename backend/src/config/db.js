/**
 * Re-export the canonical database pool from backend/config/db.js.
 * This ensures all modules (dev2, services, controllers) share the same
 * properly-configured pool: correct port, SSL for Aiven, and keepAlive.
 */
module.exports = require('../../config/db');