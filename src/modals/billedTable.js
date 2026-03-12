const { DataTypes } = require("sequelize");

/**
 * billed_table
 * Written once when a new bill is created.
 * Captures: who billed it, customer info, item count.
 */
const createBilledTable = (sequelize) => {
    return sequelize.define(
        "BilledTable",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            billNum: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            customerName: {
                type: DataTypes.STRING,
                allowNull: false
            },
            mobile: {
                type: DataTypes.STRING,
                allowNull: false
            },
            itemsCount: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            empId: {
                type: DataTypes.STRING,
                allowNull: true   // billing employee (if captured at create time)
            },
            empName: {
                type: DataTypes.STRING,
                allowNull: true
            },
            billedAt: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            }
        },
        {
            tableName: "billed_table",
            timestamps: true
        }
    );
};

module.exports = createBilledTable;
