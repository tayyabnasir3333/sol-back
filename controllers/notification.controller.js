const { bot } = require("../config/telegraf");
require("dotenv").config();
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/user.model");
const { ObjectId } = require("mongodb");

const sendNotification = asyncHandler(async (req, res) => {
  const { message, sendTo } = req.body;

  if (sendTo === "all") {
    try {
      const users = await User.find({ isAdmin: false });
      if (!users) {
        return res.status(400).json(new ApiError(400, "No Users exist"));
      }
      // Iterate through each user and send a message to their direct message
      await Promise.all(
        users.map(async (user) => {
          let telegramId = user.telegramId;
          await bot.telegram.sendMessage(telegramId, message, {
            parse_mode: "HTML",
          });

          console.log(
            "Confirmation of approval message sent to user:",
            telegramId,
          );
        }),
      );
    } catch (error) {
      if (
        error.response &&
        error.response.description === "Bad Request: chat not found"
      ) {
        console.log("Chat not found");
      } else {
        console.error("Error sending message to all users:", error);
      }
    }
  } else {
    try {
      const sendToObjectId = new ObjectId(sendTo);
      const user = await User.findById(sendToObjectId);
      if (!user) {
        return res.status(400).json(new ApiError(400, "User does not exist"));
      }
      const telegramId = user.telegramId;

      await bot.telegram.sendMessage(telegramId, message, {
        parse_mode: "HTML",
      });

      console.log("Confirmation of approval message sent to user:", telegramId);
    } catch (error) {
      if (
        error.response &&
        error.response.description === "Bad Request: chat not found"
      ) {
        console.log("Chat not found");
      } else {
        console.error("Error sending message to single user:", error);
      }
    }
  }

  return res.status(201).json(new ApiResponse(200, {}, "Notification sent"));
});

const getUsersbySearch = asyncHandler(async (req, res) => {
  try {
    let query = { isAdmin: false }; //Condition for non-admin users by default
    if (req.query.userName) {
      query.$and = [
        { isAdmin: false }, // Condition for non-admin users
        { userName: { $regex: new RegExp(req.query.userName, "i") } }, // Condition for username search
      ];
    }
    const users = await User.find(query);
    return res
      .status(201)
      .json(new ApiResponse(200, users, "Users by quary search receibed!"));
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = { sendNotification, getUsersbySearch };
