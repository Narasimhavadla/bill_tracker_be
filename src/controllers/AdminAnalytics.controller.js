const { Op } = require("sequelize");

const adminAnalyticsController = {
    // ─────────────────────────────────────────────
    // 1. KPI STATS (Updated for multi-table aggregation)
    // ─────────────────────────────────────────────
    getStats: async (req, res) => {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);

            const todayFilter = {
                createdAt: { [Op.between]: [todayStart, todayEnd] }
            };

            // 1. Total Bills Today = (Live Orders Created Today) + (Completed History Today)
            const liveCount = await req.Liveorders.count({ where: todayFilter });
            const historyCount = await req.OrderHistory.count({ 
                where: {
                    completedAt: { [Op.between]: [todayStart, todayEnd] }
                } 
            });
            const totalBillsToday = liveCount + historyCount;

            // 2. Billed Today (From BilledTable)
            const billedToday = await req.BilledTable.count({
                where: {
                    billedAt: { [Op.between]: [todayStart, todayEnd] }
                }
            });

            // 3. Picked Today (From PickingTable)
            const pickedToday = await req.PickingTable.count({
                where: {
                    pickEndTime: { [Op.between]: [todayStart, todayEnd] }
                }
            });

            // 4. Verified Today (From VerifyTable)
            const verifiedToday = await req.VerifyTable.count({
                where: {
                    verifyEndTime: { [Op.between]: [todayStart, todayEnd] }
                }
            });

            res.json({
                totalBillsToday,
                billedToday,
                pickedToday,
                verifiedToday
            });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // ─────────────────────────────────────────────
    // 2. PICKING EFFICIENCY (From PickingTable)
    // ─────────────────────────────────────────────
    getPickingEfficiency: async (req, res) => {
        try {
            const range = req.query.range || "24h";
            const now = new Date();
            let startDate = new Date();

            if (range === "7d") {
                startDate.setDate(now.getDate() - 6);
                startDate.setHours(0, 0, 0, 0);
            } else {
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            }

            // Efficiency is measured by completed picking tasks
            const orders = await req.PickingTable.findAll({
                where: {
                    pickEndTime: { [Op.gte]: startDate }
                },
                attributes: ["pickEndTime"]
            });

            let labels = [];
            let counts = {};

            if (range === "24h") {
                for (let i = 23; i >= 0; i--) {
                    const date = new Date(now.getTime() - i * 60 * 60 * 1000);
                    const hour = date.getHours().toString().padStart(2, "0") + ":00";
                    labels.push(hour);
                    counts[hour] = 0;
                }
                orders.forEach(order => {
                    const hour = new Date(order.pickEndTime).getHours().toString().padStart(2, "0") + ":00";
                    if (counts[hour] !== undefined) counts[hour]++;
                });
            }

            if (range === "7d") {
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(now);
                    date.setDate(now.getDate() - i);
                    const label = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                    labels.push(label);
                    counts[label] = 0;
                }
                orders.forEach(order => {
                    const label = new Date(order.pickEndTime).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                    if (counts[label] !== undefined) counts[label]++;
                });
            }

            const data = labels.map(l => counts[l]);
            res.json({ labels, data });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // ─────────────────────────────────────────────
    // 3. WORKLOAD DISTRIBUTION (Strictly Live Orders)
    // ─────────────────────────────────────────────
    getWorkloadDistribution: async (req, res) => {
        try {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            // We look at all active orders currently in the workflow
            const picking = await req.Liveorders.count({
                where: { status: "picking", isVisible: true }
            });

            const verifying = await req.Liveorders.count({
                where: { status: "verifying", isVisible: true }
            });

            const billed = await req.Liveorders.count({
                where: { status: "billed", isVisible: true }
            });

            // Send raw counts for the pie chart to calculate percentages
            res.json({
                picking,
                verifying,
                billed
            });

        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
};

module.exports = adminAnalyticsController;