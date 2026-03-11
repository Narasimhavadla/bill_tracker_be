const { DataTypes } = require("sequelize");

const createLiveOrder = (sequelize) => {
    return sequelize.define(
        "Liveorders", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            customerName: {
                type: DataTypes.STRING,
                allowNull: false
            },
            mobile: {
                type: DataTypes.STRING,
                allowNull: false
            },
            billNum: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            itemsCount: {
                type: DataTypes.INTEGER,
                allowNull: false
            },
            status: {
                type: DataTypes.ENUM('billed', 'picking', 'verifying', 'collect', 'completed'),
                defaultValue: 'billed',
                allowNull: false
            },
            isVisible: {
                type: DataTypes.BOOLEAN,
                defaultValue: true
            },
            isHidden: {
                type: DataTypes.BOOLEAN,
                defaultValue: false
            },

            // --- WHO is doing each task ---
            pickerId: {
                type: DataTypes.STRING,
                allowNull: true
            },
            pickerName: {
                type: DataTypes.STRING,
                allowNull: true
            },
            verifierId: {
                type: DataTypes.STRING,
                allowNull: true
            },
            verifierName: {
                type: DataTypes.STRING,
                allowNull: true
            },

            // --- TIMESTAMPS at each stage ---
            billedAt: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            pickedAt: {
                // When picking STARTS (i.e. billed -> picking scan)
                type: DataTypes.DATE,
                allowNull: true
            },
            verifiedAt: {
                // When picking ENDS / verification STARTS (i.e. picking -> verifying scan)
                type: DataTypes.DATE,
                allowNull: true
            },
            collectAt: {
                // When verification ENDS (i.e. verifying -> collect scan)
                type: DataTypes.DATE,
                allowNull: true
            },
            completedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },

            // --- DURATION fields (in seconds) ---
            pickingTimeSecs: {
                // Time spent picking: pickedAt -> verifiedAt
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            },
            verificationTimeSecs: {
                // Time spent verifying: verifiedAt -> collectAt
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            },
            totalTimeSecs: {
                // Total time: billedAt -> completedAt
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: null
            }
        }, {
            timestamps: true,
            tableName: 'live_orders'
        }
    );
};

module.exports = createLiveOrder;