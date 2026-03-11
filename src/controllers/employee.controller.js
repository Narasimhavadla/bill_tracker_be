const bcrypt = require("bcrypt")

const EmployeeController = {

  getAllEmployees: async (req, res) => {
    try {

      const employees = await req.EmployeeModal.findAll()
      const totalEmployees = await req.EmployeeModal.count()

      res.json({
        status: true,
        data: employees,
        metadata: { total_employees: totalEmployees }
      })

    } catch (error) {

      res.status(500).json({
        status: false,
        message: "Failed to fetch employees"
      })

    }
  },

  createEmployee: async (req, res) => {
    try {

      // const { empName, phone, empId, canBill, canPick, canVerify } = req.body
      const { empName, phone, empId, canPick, canVerify } = req.body

      // create employee
      const employee = await req.EmployeeModal.create({
        empName,
        phone,
        empId,
        // canBill,
        canPick,
        canVerify
      })

      // generate username
      const username = empName.toLowerCase()

      // generate password
      const namePart = empName.substring(0,4).toLowerCase()
      const phonePart = phone.substring(0,4)

      const rawPassword = namePart + phonePart

      // hash password
      const hashedPassword = await bcrypt.hash(rawPassword,10)

      // create user login
      await req.userModel.create({
        username: username,
        password: hashedPassword,
        role: "employee"
      })

      res.status(201).json({
        status: true,
        data: employee,
        loginCredentials: {
          username: username,
          password: rawPassword
        }
      })

    } catch (error) {

      console.error(error)

      res.status(500).json({
        status: false,
        message: "Employee creation failed"
      })

    }
  },

  updateEmployee: async (req, res) => {

  try {

    const { id } = req.params;

    const { empName, phone, empId, canPick, canVerify } = req.body;
    // const { empName, phone, empId, canBill, canPick, canVerify } = req.body;

    const employee = await req.EmployeeModal.findByPk(id);

    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "Employee not found"
      });
    }

    await employee.update({
      empName,
      phone,
      empId,
      // canBill,
      canPick,
      canVerify
    });

    res.json({
      status: true,
      message: "Employee updated successfully",
      data: employee
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      status: false,
      message: "Employee update failed"
    });

  }

},

updatePermissions: async (req, res) => {

  try {

    const { id } = req.params;

    // const { canBill, canPick, canVerify } = req.body;
    const {canPick, canVerify } = req.body;

    const employee = await req.EmployeeModal.findByPk(id);

    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "Employee not found"
      });
    }

    await employee.update({
      // canBill,
      canPick,
      canVerify
    });

    res.json({
      status: true,
      message: "Employee permissions updated",
      data: employee
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      status: false,
      message: "Permission update failed"
    });

  }

},

deleteEmployee: async (req, res) => {

  try {

    const { id } = req.params;

    // find employee
    const employee = await req.EmployeeModal.findByPk(id);

    if (!employee) {
      return res.status(404).json({
        status: false,
        message: "Employee not found"
      });
    }

    // delete employee login account
    const username = employee.empName.toLowerCase();

    await req.userModel.destroy({
      where: { username: username }
    });

    // delete employee record
    await employee.destroy();

    res.json({
      status: true,
      message: "Employee deleted successfully"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      status: false,
      message: "Employee deletion failed"
    });

  }

}

}

module.exports = EmployeeController