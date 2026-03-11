

const liveOrdersController = {
    createBill: async (req, res) => {
        try {
            const { customerName, mobile, billNum, itemsCount } = req.body;
            const newOrder = await req.Liveorders.create({
                customerName,
                mobile,
                billNum,
                itemsCount,
                status: 'billed'
            });
            res.status(201).json({ message: "Bill created and displayed", newOrder });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    getLiveFeed: async (req, res) => {
        try {
            const activeOrders = await req.Liveorders.findAll({
                where: {
                    // Only show orders that are NOT completed
                    isVisible: true,
                    // Only show orders that the Admin has NOT manually hidden
                    isHidden: false
                },
                // Sort so the most recently updated (e.g., "Ready for Collection") 
                // shows at the top of the list
                order: [['updatedAt', 'DESC']],
                // Selecting only the fields needed for the public display
                attributes: ['customerName', 'billNum', 'status', 'itemsCount',]
            });

            res.status(200).json({
                success: true,
                count: activeOrders.length,
                orders: activeOrders
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Failed to fetch live orders",
                error: error.message
            });
        }
    },

    scanBill: async (req, res) => {
        try {
            const { billNum, empId } = req.body;
            const now = new Date();

            // 1. Find the order
            const order = await req.Liveorders.findOne({ where: { billNum } });
            if (!order) return res.status(404).json({ message: "Bill not found" });

            // 2. Verify Employee exists and get their name
            const employee = await req.EmployeeModal.findOne({ where: { empId } });
            if (!employee) return res.status(404).json({ message: "Employee ID not recognized" });

            let updateData = {};
            let feedbackMessage = "";

            // Logic flow based on current state
            if (order.status === 'billed') {
                // START PICKING: (Time from Billed -> Scan 1)
                updateData = {
                    status: 'picking',
                    pickerId: empId,
                    pickedAt: now
                };
                feedbackMessage = `Picking started by ${employee.empName}`;

            } else if (order.status === 'picking') {
                // START VERIFYING: (Picking Ends, Verification Starts)
                updateData = {
                    status: 'verifying',
                    verifierId: empId,
                    verifiedAt: now
                };
                feedbackMessage = `Picking completed. Verification started by ${employee.empName}`;

            } else if (order.status === 'verifying') {
                // READY TO COLLECT: (Verification Ends)
                updateData = {
                    status: 'collect'
                };
                feedbackMessage = "Order verified and ready for collection";
            }

            await order.update(updateData);

            // 3. Calculate Performance Metrics for Response
            const metrics = calculateMetrics(order, updateData, now);

            res.status(200).json({
                message: feedbackMessage,
                order,
                metrics,
                currentHandler: employee.empName
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },


    completeOrder: async (req, res) => {
        try {
            const { billNum } = req.params;
            const order = await req.Liveorders.update({
                status: 'completed',
                completedAt: new Date(),
                isVisible: false // Automatically hide from customer screen
            }, { where: { billNum } });

            res.status(200).json({ message: "Order completed and removed from live view" });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    },

    toggleHide: async (req, res) => {
        try {
            const { billNum } = req.params;
            const order = await req.Liveorders.findOne({ where: { billNum } });

            if (!order) {
                return res.status(404).json({ message: "Order not found" });
            }

            // Flip the boolean value (true -> false or false -> true)
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

}

module.exports = liveOrdersController

/**
 * Helper function to calculate time differences in minutes/seconds
 */
function calculateMetrics(order, updateData, now) {
    const diffInSeconds = (start, end) => start && end ? Math.floor((end - start) / 1000) : 0;

    const metrics = {
        pickingTime: 0,
        verificationTime: 0,
        totalTimeSoFar: diffInSeconds(order.billedAt, now)
    };

    if (order.status === 'picking') {
        metrics.pickingTime = diffInSeconds(order.pickedAt, now);
    } else if (order.status === 'verifying') {
        metrics.pickingTime = diffInSeconds(order.pickedAt, now);
        metrics.verificationTime = diffInSeconds(order.verifiedAt, now);
    }

    return metrics;
}