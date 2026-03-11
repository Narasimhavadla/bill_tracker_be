require('dotenv').config();
const sequelize = require('./src/config/db');

async function fix() {
  try {
    const [indexes] = await sequelize.query('SHOW INDEXES FROM users');
    console.log(indexes);
    for (let index of indexes) {
      if (index.Key_name !== 'PRIMARY') {
        try {
          await sequelize.query(`ALTER TABLE users DROP INDEX ${index.Key_name}`);
          console.log(`Dropped index ${index.Key_name}`);
        } catch(e) {
          console.log(`Failed to drop index ${index.Key_name}`, e.message);
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
fix();
