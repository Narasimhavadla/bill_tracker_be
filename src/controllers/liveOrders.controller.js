
const diffSecs = (start, end) =>
    start && end ? Math.floor((new Date(end) - new Date(start)) / 1000) : null;

const liveOrdersController = {

    // ─── 1. CREATE BILL ────────────────────────────────────────────────────────
    createBill: async (req, res) => {
        try {
            const { customerName, mobile, billNum, itemsCount } = req.body;
            const newOrder = await req.Liveorders.create({
                customerName,
                mobile,
                billNum,
                itemsCount,
                status: 'billed',
                billedAt: new Date()
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
                    'mobile',           // ← customer mobile from create bill
                    'billNum',
                    'status',
                    'itemsCount',
                    // Who is doing each task
                    'pickerId',
                    'pickerName',
                    'verifierId',
                    'verifierName',
                    // Stage timestamps
                    'billedAt',
                    'pickedAt',
                    'verifiedAt',
                    'collectAt',
                    'completedAt',
                    // Pre-calculated durations (seconds)
                    'pickingTimeSecs',
                    'verificationTimeSecs',
                    'totalTimeSecs'
                ]
            });

            // For in-progress orders, append a live "elapsed" duration so the
            // frontend can display real-time counters without re-fetching.
            const now = new Date();
            const orders = activeOrders.map(o => {
                const plain = o.get({ plain: true });

                // Live picking duration (for orders currently being picked)
                if (plain.status === 'picking' && plain.pickedAt) {
                    plain.livePickingElapsedSecs = diffSecs(plain.pickedAt, now);
                }
                // Live verification duration (for orders currently being verified)
                if (plain.status === 'verifying' && plain.verifiedAt) {
                    plain.liveVerificationElapsedSecs = diffSecs(plain.verifiedAt, now);
                }
                // Live total elapsed since billed (any active order)
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
    //    billed   → [scan] → picking     (picking STARTS,      picker assigned)
    //    picking  → [scan] → verifying   (picking ENDS,        pickingTimeSecs stored)
    //                                    (verification STARTS, verifier assigned)
    //    verifying→ [scan] → collect     (verification ENDS,   verificationTimeSecs stored)
    //
    scanBill: async (req, res) => {
        try {
            const { billNum, empId } = req.body;
            const now = new Date();

            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) return res.status(404).json({ message: "Bill not found" });

            const employee = await req.EmployeeModal.findOne({ where: { empId } });
            if (!employee) return res.status(404).json({ message: "Employee ID not recognized" });

            let updateData = {};
            let feedbackMessage = "";

            if (order.status === 'billed') {
                // ── Picking STARTS ──────────────────────────────────────────────
                updateData = {
                    status: 'picking',
                    pickerId: empId,
                    pickerName: employee.empName,
                    pickedAt: now          // picking start timestamp
                };
                feedbackMessage = `Picking started by ${employee.empName}`;

            } else if (order.status === 'picking') {
                // ── Picking ENDS / Verification STARTS ─────────────────────────
                const pickingTimeSecs = diffSecs(order.pickedAt, now); // picking duration
                updateData = {
                    status: 'verifying',
                    verifierId: empId,
                    verifierName: employee.empName,
                    verifiedAt: now,        // verification start / picking end timestamp
                    pickingTimeSecs         // store how long picking took
                };
                feedbackMessage = `Picking completed (${formatDuration(pickingTimeSecs)}). Verification started by ${employee.empName}`;

            } else if (order.status === 'verifying') {
                // ── Verification ENDS / Ready to Collect ───────────────────────
                const verificationTimeSecs = diffSecs(order.verifiedAt, now); // verification duration
                updateData = {
                    status: 'collect',
                    collectAt: now,          // collect-ready timestamp / verification end
                    verificationTimeSecs     // store how long verification took
                };
                feedbackMessage = `Verification complete (${formatDuration(verificationTimeSecs)}). Order ready for collection`;

            } else {
                return res.status(400).json({
                    message: `Order is currently in '${order.status}' status and cannot be scanned`
                });
            }

            await order.update(updateData);
            const updated = await req.Liveorders.findOne({ where: { billNum } });

            res.status(200).json({
                message: feedbackMessage,
                order: updated,
                doingBy: employee.empName,
                metrics: buildMetrics(updated)
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    // ─── 4. COMPLETE ORDER (customer collects) ─────────────────────────────────
    completeOrder: async (req, res) => {
        try {
            const { billNum } = req.params;
            const now = new Date();

            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) return res.status(404).json({ message: "Order not found" });

            // Total time from billedAt → now (collection moment)
            const totalTimeSecs = diffSecs(order.billedAt, now);

            await order.update({
                status: 'completed',
                completedAt: now,
                isVisible: false,
                totalTimeSecs       // ← overall order duration
            });

            res.status(200).json({
                message: "Order completed and removed from live view",
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
                order: updatedOrder
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = liveOrdersController;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Builds a human-readable metrics object from a live order record.
 */
function buildMetrics(order) {
    const now = new Date();
    return {
        pickerName: order.pickerName || null,
        verifierName: order.verifierName || null,
        pickingTimeSecs: order.pickingTimeSecs ?? diffSecs(order.pickedAt, now),
        pickingTimeFormatted: formatDuration(order.pickingTimeSecs ?? diffSecs(order.pickedAt, now)),
        verificationTimeSecs: order.verificationTimeSecs ?? diffSecs(order.verifiedAt, now),
        verificationTimeFormatted: formatDuration(order.verificationTimeSecs ?? diffSecs(order.verifiedAt, now)),
        totalTimeSecs: order.totalTimeSecs ?? diffSecs(order.billedAt, now),
        totalTimeFormatted: formatDuration(order.totalTimeSecs ?? diffSecs(order.billedAt, now))
    };
}

/**
 * Converts seconds → "Xm Ys" string. Returns null if value is null/0.
 */
function formatDuration(secs) {
    if (secs == null || secs <= 0) return null;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}