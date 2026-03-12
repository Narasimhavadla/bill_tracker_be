const { DataTypes } = require("sequelize");

/**
 * picking_table
 * Written when picking ends (scan: picking → verifying).
 * Stores pick start time (pickedAt from live_orders) and pick end time (now).
 */
const createPickingTable = (sequelize) => {
    return sequelize.define(
        "PickingTable",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            billNum: {
                type: DataTypes.STRING,
                allowNull: false
            },
            empId: {
                type: DataTypes.STRING,
                allowNull: false
            },
            empName: {
                type: DataTypes.STRING,
                allowNull: false
            },
            pickStartTime: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "When picking started (billed → picking scan)"
            },
            pickEndTime: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "When picking ended (picking → verifying scan)"
            },
            pickingDurationSecs: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Seconds from pickStartTime to pickEndTime"
            }
        },
        {
            tableName: "picking_table",
            timestamps: true
        }
    );
};

module.exports = createPickingTable;
