const express = require('express');
const router = express.Router();

const liveOrdersController = require("../controllers/liveOrders.controller");

// 1. Initial Billing (Admin / Cashier)
//    Body: { customerName, mobile, billNum, itemsCount, empId? }
router.post('/order/create', liveOrdersController.createBill);

// 2. Employee Scanning (Picking & Verifying)
//    Body: { billNum, empId }
//    Status transitions automatically:  billed → picking → verifying → collect
router.post('/order/scan', liveOrdersController.scanBill);

// 3. Admin Manual Hide (Toggle)
router.patch('/order/toggle-hide/:billNum', liveOrdersController.toggleHide);

// 4. Final Collection — marks 'completed' and saves order_history row
router.patch('/order/complete/:billNum', liveOrdersController.completeOrder);

// 5. Public Live Screen Feed
router.get('/order/live-feed', liveOrdersController.getLiveFeed);

// ── Admin / Reporting routes ──────────────────────────────────────────────────

// 6. Full history of all completed orders (admin dashboard)
router.get('/order/history', liveOrdersController.getOrderHistory);

// 7. Drill-down for a single bill — returns billed, picking, verify & history rows
router.get('/order/history/:billNum', liveOrdersController.getBillHistory);

module.exports = router;