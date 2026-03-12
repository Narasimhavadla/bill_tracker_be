
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
                    isHidden: false
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
                    'totalTimeSecs'
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

    // ─── 3. SCAN BILL (employee scans to advance the stage) ───────────────────
    //
    //  Flow:
    //    billed    → [scan] → picking    → writes nothing yet (picking STARTS)
    //    picking   → [scan] → verifying  → writes row to picking_table (picking ENDS)
    //    verifying → [scan] → collect    → writes row to verify_table  (verify ENDS)
    //
    scanBill: async (req, res) => {
        try {
            const { billNum, empId } = req.body;
            const now = new Date();

            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) return res.status(404).json({ message: "Bill not found" });

            const employee = await req.EmployeeModal.findOne({ where: { empId } });
            if (!employee) return res.status(404).json({ message: "Employee ID not recognized" });

            let updateData     = {};
            let feedbackMessage = "";

            if (order.status === 'billed') {
                // ── Picking STARTS ────────────────────────────────────────────────
                updateData = {
                    status:     'picking',
                    pickerId:   empId,
                    pickerName: employee.empName,
                    pickedAt:   now          // pickStartTime
                };
                feedbackMessage = `Picking started by ${employee.empName}`;

            } else if (order.status === 'picking') {
                // ── Picking ENDS / Verification STARTS ───────────────────────────
                const pickingTimeSecs = diffSecs(order.pickedAt, now);

                updateData = {
                    status:          'verifying',
                    verifierId:      empId,
                    verifierName:    employee.empName,
                    verifiedAt:      now,          // verifyStartTime / pickEndTime
                    pickingTimeSecs               // store duration in live_orders too
                };
                feedbackMessage = `Picking completed (${formatDuration(pickingTimeSecs)}). Verification started by ${employee.empName}`;

                // ── Write to picking_table ────────────────────────────────────────
                await req.PickingTable.create({
                    billNum,
                    empId,
                    empName:            employee.empName,
                    pickStartTime:      order.pickedAt,   // when picking started
                    pickEndTime:        now,               // now = picking ended
                    pickingDurationSecs: pickingTimeSecs
                });

            } else if (order.status === 'verifying') {
                // ── Verification ENDS / Ready to Collect ─────────────────────────
                const verificationTimeSecs = diffSecs(order.verifiedAt, now);

                updateData = {
                    status:                'collect',
                    collectAt:             now,           // verifyEndTime / collect-ready
                    verificationTimeSecs                 // store duration in live_orders too
                };
                feedbackMessage = `Verification complete (${formatDuration(verificationTimeSecs)}). Order ready for collection`;

                // ── Write to verify_table ─────────────────────────────────────────
                await req.VerifyTable.create({
                    billNum,
                    empId,
                    empName:             employee.empName,
                    itemsCount:          order.itemsCount,
                    verifyStartTime:     order.verifiedAt,  // when verification started
                    verifyEndTime:       now,                // now = verification ended
                    verifyDurationSecs:  verificationTimeSecs
                });

            } else {
                return res.status(400).json({
                    message: `Order is currently in '${order.status}' status and cannot be scanned`
                });
            }

            await order.update(updateData);
            const updated = await req.Liveorders.findOne({ where: { billNum } });

            res.status(200).json({
                message:   feedbackMessage,
                order:     updated,
                doingBy:   employee.empName,
                metrics:   buildMetrics(updated)
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