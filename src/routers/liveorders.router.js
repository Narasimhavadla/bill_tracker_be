const express = require('express');
const router = express.Router();

const liveOrdersController = require("../controllers/liveOrders.controller")

// 1. Initial Billing (Admin)
router.post('/order/create', liveOrdersController.createBill);

// 2. Employee Scanning (Picking & Verifying)
// Logic: Post billNum + empId. Status moves automatically.
router.post('/order/scan', liveOrdersController.scanBill);

// 3. Admin Manual Hide (Toggle)
// Logic: Hides/Shows order on the public screen immediately.
router.patch('/order/toggle-hide/:billNum', liveOrdersController.toggleHide);

// 4. Final Collection (Customer Pickup)
// Logic: Moves status to 'completed' and sets isVisible to false.
router.patch('/order/complete/:billNum', liveOrdersController.completeOrder);

// 5. Public Live Screen Feed
// Logic: Get only where isVisible: true AND isHidden: false.
router.get('/order/live-feed', liveOrdersController.getLiveFeed);

module.exports = router;