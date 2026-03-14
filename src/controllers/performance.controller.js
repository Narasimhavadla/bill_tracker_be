const { Op } = require('sequelize');
const { OrderHistory, EmployeeModal } = require('../modals/index');

const PerformanceController = {
  getEmployeePerformance: async (req, res) => {
    try {
      const { month } = req.query; 
      const startOfMonth = new Date(`${month}-01T00:00:00`);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

      const employees = await req.EmployeeModal.findAll();
      
      const performanceReport = await Promise.all(employees.map(async (emp) => {
        // Find all orders where this employee was either the picker or verifier
        const orders = await req.OrderHistory.findAll({
          where: {
            [Op.or]: [{ pickerId: emp.empId }, { verifierId: emp.empId }],
            completedAt: { [Op.between]: [startOfMonth, endOfMonth] }
          }
        });

        const pickedOrders = orders.filter(o => o.pickerId === emp.empId);
        const verifiedOrders = orders.filter(o => o.verifierId === emp.empId);

        const itemsPicked = pickedOrders.reduce((sum, o) => sum + (o.itemsCount || 0), 0);
        const itemsVerified = verifiedOrders.reduce((sum, o) => sum + (o.itemsCount || 0), 0);

        // Formula: (Total Items * Total Bills) / 9 working hours
        const totalItems = itemsPicked + itemsVerified;
        const totalBills = pickedOrders.length + verifiedOrders.length;
        const efficiencyScore = totalBills > 0 ? ((totalItems * totalBills) / 9).toFixed(2) : 0;

        return {
          empId: emp.empId,
          name: emp.empName,
          itemsPicked,
          itemsVerified,
          billsPicked: pickedOrders.length,
          billsVerified: verifiedOrders.length,
          efficiency: efficiencyScore,
          // Calculate avg speed from stored duration secs
          avgSpeed: totalBills > 0 
            ? Math.floor((pickedOrders.reduce((s, o) => s + o.pickingDurationSecs, 0) + 
              verifiedOrders.reduce((s, o) => s + o.verifyDurationSecs, 0)) / totalBills) + "s"
            : "0s"
        };
      }));

      res.json({ success: true, data: performanceReport });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  // Detailed work log for a specific employee
  getEmployeeWorkLog: async (req, res) => {
    try {
      const { empId } = req.params;
      const { month } = req.query;
      
      const startOfMonth = new Date(`${month}-01T00:00:00`);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

      const logs = await req.OrderHistory.findAll({
        where: {
          [Op.or]: [{ pickerId: empId }, { verifierId: empId }],
          completedAt: { [Op.between]: [startOfMonth, endOfMonth] }
        },
        order: [['completedAt', 'DESC']]
      });

      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};

module.exports = PerformanceController;