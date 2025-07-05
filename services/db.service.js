const mysql=require("mysql2/promise")
const config=require("../config")

// Créez un pool de connexions
const pool = mysql.createPool(config.db);

async function query(sql, params) {
    const [results] = await pool.execute(sql, params);
    return results;
}

module.exports = {
    query
};
