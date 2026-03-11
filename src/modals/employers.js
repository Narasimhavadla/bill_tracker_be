const {DataTypes} = require("sequelize")


const createEmployee = (sequelize) =>{
    return sequelize.define(
        "Employees",{
            id : {
                type : DataTypes.INTEGER,
                autoIncrement : true,
                primaryKey : true
            },
            empName : {
                type : DataTypes.STRING,
                allowNull : false
            },
            phone : {
                type : DataTypes.STRING,
                allowNull : false
            },
            empId : {
                type : DataTypes.STRING,
                allowNull : true
            },
            // canBill : {
            //     type : DataTypes.STRING
            // },
            canPick : {
                type : DataTypes.STRING
            },
            canVerify : {
                type : DataTypes.STRING
            }
        },
        {
            tableName : "Employees",
            timestamps : true
        }
    )

}

module.exports = createEmployee;