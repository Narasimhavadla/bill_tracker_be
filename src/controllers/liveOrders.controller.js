
const diffSecs = (start, end) =>
    start && end ? Math.floor((new Date(end) - new Date(start)) / 1000) : null;

const liveOrdersController = {

    // ─── 1. CREATE BILL ────────────────────────────────────────────────────────
    //
    // Also writes a row to billed_table for tracking.
    // Optional: pass `empId` in the body to capture which employee billed it.
    createBill: async (req, res) => {
        try {
            const { customerName, mobile, billNum, itemsCount, empId } = req.body;
            const now = new Date();

            // Resolve billing employee name (optional)
            let empName = null;
            if (empId) {
                const employee = await req.EmployeeModal.findOne({ where: { empId } });
                if (employee) empName = employee.empName;
            }

            // 1. Create the live order
            const newOrder = await req.Liveorders.create({
                customerName,
                mobile,
                billNum,
                itemsCount,
                empId,
                status: 'billed',
                billedAt: now
            });

            // 2. Write to billed_table
            await req.BilledTable.create({
                billNum,
                customerName,
                mobile,
                itemsCount,
                empId:   empId   || null,
                empName: empName || null,
                billedAt: now
            });

            res.status(201).json({ message: "Bill created and displayed", newOrder });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // ─── 2. LIVE FEED ──────────────────────────────────────────────────────────
    getLiveFeed: async (req, res) => {
        try {
            const activeOrders = await req.Liveorders.findAll({
                where: {
                    isVisible: true,
                    // isHidden: false
                },
                order: [['updatedAt', 'DESC']],
               attributes: [
                'customerName',
                'mobile',
                'billNum',
                'status',
                'itemsCount',
                'pickerId',
                'pickerName',
                'verifierId',
                'verifierName',
                'billedAt',
                'pickedAt',
                'verifiedAt',
                'collectAt',
                'completedAt',
                'pickingTimeSecs',
                'verificationTimeSecs',
                'totalTimeSecs',
                'isHidden'
                ]
            });

            const now = new Date();
            const orders = activeOrders.map(o => {
                const plain = o.get({ plain: true });

                if (plain.status === 'picking' && plain.pickedAt) {
                    plain.livePickingElapsedSecs = diffSecs(plain.pickedAt, now);
                }
                if (plain.status === 'verifying' && plain.verifiedAt) {
                    plain.liveVerificationElapsedSecs = diffSecs(plain.verifiedAt, now);
                }
                if (plain.billedAt) {
                    plain.liveTotalElapsedSecs = diffSecs(plain.billedAt, now);
                }
                return plain;
            });

            res.status(200).json({
                success: true,
                count: orders.length,
                orders
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Failed to fetch live orders",
                error: error.message
            });
        }
    },

    // ─── 3a. START PICKING ─────────────────────────────────────────────────────
    //
    //  Allowed only when status === 'billed'.
    //  Transitions: billed → picking
    //  Records: pickerId, pickerName, pickedAt (pick start time) in live_orders
    //
    //  POST /api/v1/order/scan/pick
    //  Body: { billNum, empId }
    //
    startPicking: async (req, res) => {
        try {
            const { billNum, empId } = req.body;

            if (!billNum || !empId) {
                return res.status(400).json({ message: "billNum and empId are required" });
            }

            const now = new Date();

            // ── Fetch order ───────────────────────────────────────────────────
            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) {
                return res.status(404).json({ message: `Bill '${billNum}' not found` });
            }

            // ── Strict status guard ───────────────────────────────────────────
            if (order.status !== 'billed') {
                const hint = {
                    picking:   "This order is already being picked.",
                    verifying: "This order has already been picked and is in verification. Complete verification first.",
                    collect:   "This order has already been verified and is ready for collection.",
                    completed: "This order is already completed."
                }[order.status] || `Current status is '${order.status}'.`;

                return res.status(400).json({
                    message: `Cannot start picking — order is not in 'billed' status. ${hint}`,
                    currentStatus: order.status
                });
            }

            // ── Fetch employee ────────────────────────────────────────────────
            const employee = await req.EmployeeModal.findOne({ where: { empId } });
            if (!employee) {
                return res.status(404).json({ message: `Employee ID '${empId}' not recognized` });
            }

            // ── Update live order: billed → picking ───────────────────────────
            await order.update({
                status:     'picking',
                pickerId:   empId,
                pickerName: employee.empName,
                pickedAt:   now                // pick START time
            });

            const updated = await req.Liveorders.findOne({ where: { billNum } });

            res.status(200).json({
                message:       `Picking started by ${employee.empName}`,
                currentStatus: 'picking',
                pickerName:    employee.empName,
                pickStartTime: now,
                order:         updated
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // ─── 3b. START VERIFYING ──────────────────────────────────────────────────
    //
    //  Allowed only when status === 'picking'.
    //  Transitions: picking → verifying
    //  Records: pickEndTime, pickingDurationSecs → picking_table
    //           verifierId, verifierName, verifiedAt (verify start) → live_orders
    //
    //  POST /api/v1/order/scan/verify
    //  Body: { billNum, empId }
    //
    startVerifying: async (req, res) => {
        try {
            const { billNum, empId } = req.body;

            if (!billNum || !empId) {
                return res.status(400).json({ message: "billNum and empId are required" });
            }

            const now = new Date();

            // ── Fetch order ───────────────────────────────────────────────────
            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) {
                return res.status(404).json({ message: `Bill '${billNum}' not found` });
            }

            // ── Strict status guard ───────────────────────────────────────────
            if (order.status !== 'picking') {
                const hint = {
                    billed:    "This order has not been picked yet. Please start picking first using /order/scan/pick.",
                    verifying: "This order is already in verification.",
                    collect:   "This order has already been verified and is ready for collection.",
                    completed: "This order is already completed."
                }[order.status] || `Current status is '${order.status}'.`;

                return res.status(400).json({
                    message: `Cannot start verification — order is not in 'picking' status. ${hint}`,
                    currentStatus: order.status
                });
            }

            // ── Fetch employee ────────────────────────────────────────────────
            const employee = await req.EmployeeModal.findOne({ where: { empId } });
            if (!employee) {
                return res.status(404).json({ message: `Employee ID '${empId}' not recognized` });
            }

            // ── Calculate picking duration ────────────────────────────────────
            const pickingTimeSecs = diffSecs(order.pickedAt, now);

            // ── Write to picking_table (picking is now DONE) ──────────────────
            await req.PickingTable.create({
                billNum,
                empId:              order.pickerId,          // the one who did the picking
                empName:            order.pickerName,
                pickStartTime:      order.pickedAt,          // pick start
                pickEndTime:        now,                     // pick end = verify start
                pickingDurationSecs: pickingTimeSecs
            });

            // ── Update live order: picking → verifying ────────────────────────
            await order.update({
                status:          'verifying',
                verifierId:      empId,
                verifierName:    employee.empName,
                verifiedAt:      now,                        // verify START time
                pickingTimeSecs
            });

            const updated = await req.Liveorders.findOne({ where: { billNum } });

            res.status(200).json({
                message:           `Picking completed (${formatDuration(pickingTimeSecs)}). Verification started by ${employee.empName}`,
                currentStatus:     'verifying',
                pickerName:        order.pickerName,
                pickStartTime:     order.pickedAt,
                pickEndTime:       now,
                pickingDuration:   formatDuration(pickingTimeSecs),
                pickingTimeSecs,
                verifierName:      employee.empName,
                verifyStartTime:   now,
                order:             updated,
                metrics:           buildMetrics(updated)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // ─── 3c. READY TO COLLECT ─────────────────────────────────────────────────
    //
    //  Allowed only when status === 'verifying'.
    //  Transitions: verifying → collect
    //  Records: verifyEndTime, verifyDurationSecs → verify_table
    //           collectAt → live_orders
    //
    //  POST /api/v1/order/scan/collect
    //  Body: { billNum, empId }
    //
    readyToCollect: async (req, res) => {
        try {
            const { billNum, empId } = req.body;

            if (!billNum || !empId) {
                return res.status(400).json({ message: "billNum and empId are required" });
            }

            const now = new Date();

            // ── Fetch order ───────────────────────────────────────────────────
            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) {
                return res.status(404).json({ message: `Bill '${billNum}' not found` });
            }

            // ── Strict status guard ───────────────────────────────────────────
            if (order.status !== 'verifying') {
                const hint = {
                    billed:    "This order has not been picked yet. Start picking first using /order/scan/pick.",
                    picking:   "This order is still being picked. Complete picking first using /order/scan/verify.",
                    collect:   "This order is already ready for collection.",
                    completed: "This order is already completed."
                }[order.status] || `Current status is '${order.status}'.`;

                return res.status(400).json({
                    message: `Cannot mark as collect — order is not in 'verifying' status. ${hint}`,
                    currentStatus: order.status
                });
            }

            // ── Fetch employee ────────────────────────────────────────────────
            const employee = await req.EmployeeModal.findOne({ where: { empId } });
            if (!employee) {
                return res.status(404).json({ message: `Employee ID '${empId}' not recognized` });
            }

            // ── Calculate verification duration ───────────────────────────────
            const verificationTimeSecs = diffSecs(order.verifiedAt, now);

            // ── Write to verify_table (verification is now DONE) ─────────────
            await req.VerifyTable.create({
                billNum,
                empId:              order.verifierId,        // the one who verified
                empName:            order.verifierName,
                itemsCount:         order.itemsCount,
                verifyStartTime:    order.verifiedAt,        // verify start
                verifyEndTime:      now,                     // verify end
                verifyDurationSecs: verificationTimeSecs
            });

            // ── Update live order: verifying → collect ────────────────────────
            await order.update({
                status:               'collect',
                collectAt:            now,
                verificationTimeSecs
            });

            const updated = await req.Liveorders.findOne({ where: { billNum } });

            res.status(200).json({
                message:             `Verification complete (${formatDuration(verificationTimeSecs)}). Order is ready for collection`,
                currentStatus:       'collect',
                verifierName:        order.verifierName,
                verifyStartTime:     order.verifiedAt,
                verifyEndTime:       now,
                verifyDuration:      formatDuration(verificationTimeSecs),
                verificationTimeSecs,
                order:               updated,
                metrics:             buildMetrics(updated)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // ─── 4. COMPLETE ORDER (customer collects) ─────────────────────────────────
    //
    // Marks the order as completed and writes the FULL lifecycle summary
    // to order_history for admin reporting.
    //
    completeOrder: async (req, res) => {
        try {
            const { billNum } = req.params;
            const now = new Date();

            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) return res.status(404).json({ message: "Order not found" });

            if (order.status !== 'collect') {
                return res.status(400).json({
                    message: `Order must be in 'collect' status to complete. Current status: '${order.status}'`
                });
            }

            const totalTimeSecs = diffSecs(order.billedAt, now);

            // 1. Update live order
            await order.update({
                status:       'completed',
                completedAt:  now,
                isVisible:    false,
                totalTimeSecs
            });

            // 2. Write consolidated history row
            await req.OrderHistory.create({
                billNum,
                customerName:        order.customerName,
                mobile:              order.mobile,
                itemsCount:          order.itemsCount,

                // billed
                billedAt:            order.billedAt,

                // picking
                pickerId:            order.pickerId,
                pickerName:          order.pickerName,
                pickStartTime:       order.pickedAt,
                pickEndTime:         order.verifiedAt,     // picking ended when verifying started
                pickingDurationSecs: order.pickingTimeSecs,

                // verifying
                verifierId:          order.verifierId,
                verifierName:        order.verifierName,
                verifyStartTime:     order.verifiedAt,
                verifyEndTime:       order.collectAt,      // verify ended when collect started
                verifyDurationSecs:  order.verificationTimeSecs,

                // collect & complete
                collectOrderTime:    order.collectAt,
                completedAt:         now,
                totalTimeSecs,
                status:              'completed'
            });

            res.status(200).json({
                message:            "Order completed — history saved",
                totalTimeSecs,
                totalTimeFormatted: formatDuration(totalTimeSecs)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // ─── 5. TOGGLE HIDE ────────────────────────────────────────────────────────
    toggleHide: async (req, res) => {
        try {
            const { billNum } = req.params;
            const order = await req.Liveorders.findOne({ where: { billNum } });

            if (!order) return res.status(404).json({ message: "Order not found" });

            const updatedOrder = await order.update({
                isHidden: !order.isHidden
            });

            res.status(200).json({
                message: `Order visibility toggled. isHidden is now: ${updatedOrder.isHidden}`,
                order:   updatedOrder
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // ─── 6. GET ORDER HISTORY (admin full lifecycle view) ──────────────────────
    getOrderHistory: async (req, res) => {
        try {
            const history = await req.OrderHistory.findAll({
                order: [['completedAt', 'DESC']]
            });

            // Attach formatted durations for easy display
            const rows = history.map(h => {
                const plain = h.get({ plain: true });
                plain.pickingTimeFormatted      = formatDuration(plain.pickingDurationSecs);
                plain.verifyTimeFormatted       = formatDuration(plain.verifyDurationSecs);
                plain.totalTimeFormatted        = formatDuration(plain.totalTimeSecs);
                return plain;
            });

            res.status(200).json({
                success: true,
                count:   rows.length,
                history: rows
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    },

    // ─── 7. GET SINGLE BILL HISTORY (admin drill-down) ────────────────────────
    getBillHistory: async (req, res) => {
        try {
            const { billNum } = req.params;

            const [billed, picking, verify, history] = await Promise.all([
                req.BilledTable.findOne({ where: { billNum } }),
                req.PickingTable.findOne({ where: { billNum } }),
                req.VerifyTable.findOne({ where: { billNum } }),
                req.OrderHistory.findOne({ where: { billNum } })
            ]);

            if (!billed && !history) {
                return res.status(404).json({ message: "No records found for this bill number" });
            }

            res.status(200).json({
                success: true,
                billNum,
                billedRecord:  billed  || null,
                pickingRecord: picking || null,
                verifyRecord:  verify  || null,
                historyRecord: history || null
            });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
};

module.exports = liveOrdersController;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildMetrics(order) {
    const now = new Date();
    return {
        pickerName:                  order.pickerName || null,
        verifierName:                order.verifierName || null,
        pickingTimeSecs:             order.pickingTimeSecs ?? diffSecs(order.pickedAt, now),
        pickingTimeFormatted:        formatDuration(order.pickingTimeSecs ?? diffSecs(order.pickedAt, now)),
        verificationTimeSecs:        order.verificationTimeSecs ?? diffSecs(order.verifiedAt, now),
        verificationTimeFormatted:   formatDuration(order.verificationTimeSecs ?? diffSecs(order.verifiedAt, now)),
        totalTimeSecs:               order.totalTimeSecs ?? diffSecs(order.billedAt, now),
        totalTimeFormatted:          formatDuration(order.totalTimeSecs ?? diffSecs(order.billedAt, now))
    };
}

function formatDuration(secs) {
    if (secs == null || secs <= 0) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}


