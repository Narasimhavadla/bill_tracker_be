const { DataTypes } = require("sequelize");

/**
 * verify_table
 * Written when verification ends (scan: verifying → collect).
 * Stores verify start time (verifiedAt from live_orders) and verify end time (now).
 */
const createVerifyTable = (sequelize) => {
    return sequelize.define(
        "VerifyTable",
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
            itemsCount: {
                type: DataTypes.INTEGER,
                allowNull: true
            },
            verifyStartTime: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "When verification started (picking → verifying scan)"
            },
            verifyEndTime: {
                type: DataTypes.DATE,
                allowNull: false,
                comment: "When verification ended (verifying → collect scan)"
            },
            verifyDurationSecs: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Seconds from verifyStartTime to verifyEndTime"
            }
        },
        {
            tableName: "verify_table",
            timestamps: true
        }
    );
};

module.exports = createVerifyTable;
