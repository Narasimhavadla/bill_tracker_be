const express = require('express');
const router = express.Router();

const liveOrdersController = require("../controllers/liveOrders.controller");
const adminAnalyticsController = require("../controllers/AdminAnalytics.controller")
const PerformanceController = require("../controllers/performance.controller");


// ─── BILLING ─────────────────────────────────────────────────────────────────
// Create a new bill (Admin / Cashier)
router.post('/order/create', liveOrdersController.createBill);


// ─── PICKING MODULE ───────────────────────────────────────────────────────────
// Start picking — only works if order status is 'billed'
// On success  → status becomes 'picking', records pickStartTime
// On wrong status → 400 with clear reason why it was rejected
router.post('/order/scan/pick', liveOrdersController.startPicking);


// ─── VERIFYING MODULE ─────────────────────────────────────────────────────────
// Start verifying — only works if order status is 'picking'
// On success  → status becomes 'verifying', closes picking_table row (pickStart→pickEnd)
// On wrong status → 400 with clear reason (e.g. "must pick first")
router.post('/order/scan/verify', liveOrdersController.startVerifying);


// ─── COLLECT MODULE ───────────────────────────────────────────────────────────
// Mark order ready for collection — only works if status is 'verifying'
// On success  → status becomes 'collect', closes verify_table row (verifyStart→verifyEnd)
// On wrong status → 400 with clear reason (e.g. "must verify first")
router.post('/order/scan/collect', liveOrdersController.readyToCollect);


// ─── COMPLETE ORDER ───────────────────────────────────────────────────────────
// Customer collects the order — only works if status is 'collect'
// Marks status as 'completed', hides from live feed, writes full row to order_history
router.patch('/order/complete/:billNum', liveOrdersController.completeOrder);


// ─── ADMIN UTILITIES ──────────────────────────────────────────────────────────
// Toggle hide/show on live screen
router.patch('/order/toggle-hide/:billNum', liveOrdersController.toggleHide);

// Live display feed (only visible, non-hidden active orders)
router.get('/order/live-feed', liveOrdersController.getLiveFeed);

// Full history of all completed orders (admin dashboard)
router.get('/order/history', liveOrdersController.getOrderHistory);

// Drill-down for a single bill — billed + picking + verify + history rows
router.get('/order/history/:billNum', liveOrdersController.getBillHistory);

router.get('/analytics/stats',adminAnalyticsController.getStats)
router.get('/analytics/picking-efficiency',adminAnalyticsController.getPickingEfficiency)
router.get('/analytics/workload',adminAnalyticsController.getWorkloadDistribution)



router.get("/performance/report", PerformanceController.getEmployeePerformance);
router.get("/performance/worklog/:empId", PerformanceController.getEmployeeWorkLog);

module.exports = router;

