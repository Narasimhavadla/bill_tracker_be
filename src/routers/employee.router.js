const express = require("express")

const router = express.Router()

const EmployeeController = require("../controllers/employee.controller")

router.get("/employees", EmployeeController.getAllEmployees)

router.post("/employees", EmployeeController.createEmployee)

router.put("/employees/:id", EmployeeController.updateEmployee)

router.patch("/employees/:id/permissions", EmployeeController.updatePermissions)

router.delete("/employees/:id", EmployeeController.deleteEmployee)

module.exports = router