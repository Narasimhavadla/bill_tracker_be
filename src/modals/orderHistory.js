const { DataTypes } = require("sequelize");

/**
 * order_history
 * Written once when an order is marked as 'completed' (customer collects).
 * Full consolidated summary of the entire order lifecycle.
 */
const createOrderHistory = (sequelize) => {
    return sequelize.define(
        "OrderHistory",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },

            // ── Core order info ───────────────────────────────────────
            billNum: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            customerName: {
                type: DataTypes.STRING,
                allowNull: true
            },
            mobile: {
                type: DataTypes.STRING,
                allowNull: true
            },
            itemsCount: {
                type: DataTypes.INTEGER,
                allowNull: true
            },

            // ── Billed stage ──────────────────────────────────────────
            billedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },

            // ── Picking stage ─────────────────────────────────────────
            pickerId: {
                type: DataTypes.STRING,
                allowNull: true
            },
            pickerName: {
                type: DataTypes.STRING,
                allowNull: true
            },
            pickStartTime: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When picking started"
            },
            pickEndTime: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When picking ended"
            },
            pickingDurationSecs: {
                type: DataTypes.INTEGER,
                allowNull: true
            },

            // ── Verify stage ──────────────────────────────────────────
            verifierId: {
                type: DataTypes.STRING,
                allowNull: true
            },
            verifierName: {
                type: DataTypes.STRING,
                allowNull: true
            },
            verifyStartTime: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When verification started"
            },
            verifyEndTime: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When verification ended"
            },
            verifyDurationSecs: {
                type: DataTypes.INTEGER,
                allowNull: true
            },

            // ── Collect stage ─────────────────────────────────────────
            collectOrderTime: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When order became ready for collection"
            },
            completedAt: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: "When customer collected / order marked completed"
            },

            // ── Summary ───────────────────────────────────────────────
            totalTimeSecs: {
                type: DataTypes.INTEGER,
                allowNull: true,
                comment: "Total time from billedAt to completedAt"
            },
            status: {
                type: DataTypes.STRING,
                defaultValue: "completed"
            }
        },
        {
            tableName: "order_history",
            timestamps: true
        }
    );
};

module.exports = createOrderHistory;
