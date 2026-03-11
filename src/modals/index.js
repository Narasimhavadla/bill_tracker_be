const sequelize = require('../config/db');

const createUserModels = require('./users')
const createEmployee = require("./employers")
const createLiveOrder = require("./liveOrders")


const userModel = createUserModels(sequelize);
const EmployeeModal = createEmployee(sequelize);
const Liveorders = createLiveOrder(sequelize);



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
}