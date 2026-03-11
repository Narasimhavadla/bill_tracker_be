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
            itemsCount :{
                type : DataTypes.INTEGER,
                allowNull : false
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
            pickerId: {
                type: DataTypes.STRING,
                allowNull: true
            },
            verifierId: {
                type: DataTypes.STRING,
                allowNull: true
            },
            billedAt: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW
            },
            pickedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            verifiedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            completedAt: {
                type: DataTypes.DATE,
                allowNull: true
            }
        }, {
            timestamps: true, 
            tableName: 'live_orders'
        }
    );
};

module.exports = createLiveOrder;