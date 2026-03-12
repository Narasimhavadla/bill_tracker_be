const sequelize = require('../config/db');

const createUserModels    = require('./users');
const createEmployee      = require('./employers');
const createLiveOrder     = require('./liveOrders');
const createBilledTable   = require('./billedTable');
const createPickingTable  = require('./pickingTable');
const createVerifyTable   = require('./verifyTable');
const createOrderHistory  = require('./orderHistory');

const userModel      = createUserModels(sequelize);
const EmployeeModal  = createEmployee(sequelize);
const Liveorders     = createLiveOrder(sequelize);
const BilledTable    = createBilledTable(sequelize);
const PickingTable   = createPickingTable(sequelize);
const VerifyTable    = createVerifyTable(sequelize);
const OrderHistory   = createOrderHistory(sequelize);

const initDb = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ DB connected");

    if (process.env.NODE_ENV !== "production") {
      await sequelize.sync({ alter: true });
      console.log("🛠 DB synced (alter mode)");
    } else {
      await sequelize.sync();
      console.log("✅ DB synced");
    }
  } catch (error) {
    console.error("❌ DB connection failed:", error);
  }
};

module.exports = {
    initDb,
    userModel,
    EmployeeModal,
    Liveorders,
    BilledTable,
    PickingTable,
    VerifyTable,
    OrderHistory,
};