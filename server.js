const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const { initDb, userModel, EmployeeModal, Liveorders, BilledTable, PickingTable, VerifyTable, OrderHistory } = require('./src/modals');
const authRouter = require('./src/routers/auth.Router');
const employeeRouter = require('./src/routers/employee.router')
const liveOrderRouter = require("./src/routers/liveorders.router")


const app = express();

app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  req.userModel     = userModel;
  req.EmployeeModal = EmployeeModal;
  req.Liveorders    = Liveorders;
  req.BilledTable   = BilledTable;
  req.PickingTable  = PickingTable;
  req.VerifyTable   = VerifyTable;
  req.OrderHistory  = OrderHistory;
  next();
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1', employeeRouter);
app.use('/api/v1', liveOrderRouter);

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await initDb();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Database connection failed:", err);
    process.exit(1);
  }
}

startServer();