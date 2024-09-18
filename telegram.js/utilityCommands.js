const { bot } = require("../config/telegraf");
const { checkUserByTId } = require("../controllers/auth.controller");

const refCommandUtility = async (ctx) => {
  const user = await checkUserByTId(ctx.from.id);
  async function getUsersWithLevels(userId, level = 0) {
    const usersWithLevels = [];

    // Find the user document
    const user = await userModel.findById(userId);

    if (!user) {
      return usersWithLevels; // User not found
    }

    // Add the user and their level to the result
    usersWithLevels.push({ user, level });

    // If the user has referred users, recursively find users with levels for each referred user
    for (const referredUserId of user.referredUsers) {
      const referredUserUsersWithLevels = await getUsersWithLevels(
        referredUserId,
        level + 1,
      );
      usersWithLevels.push(...referredUserUsersWithLevels);
    }

    return usersWithLevels;
  }
  const getUserLevels = async (id) => {
    try {
      const usersWithLevels = await getUsersWithLevels(id);
      return usersWithLevels;
    } catch (error) {
      console.error("Error:", error);
    }
  };
  const downline = await getUserLevels(user?._id);
  const groupedUsers = {};

  downline.forEach((item) => {
    const level = item.level;
    if (!groupedUsers[level]) {
      groupedUsers[level] = []; // Create an array for the level if it doesn't exist
    }
    groupedUsers[level].push(item.user); // Push the user to the array of their level
  });

  console.log("Grouped Users:", groupedUsers);
  const levelCounts = {};
  Object.keys(groupedUsers).forEach((level) => {
    levelCounts[level] = groupedUsers[level].length;
  });

  // Construct the message dynamically
  let message = `Your affiliate link is: https://t.me/jmmirzabot?start=${user.referralLink}\n`;
  message += `Your network is made up of ${downline.length - 1} users\n`;
  Object.keys(levelCounts).forEach((level) => {
    if (level !== "0") {
      // Exclude the 0th level
      message += `${levelCounts[level]} users in level ${level}\n`;
    }
  });
  bot.telegram.sendMessage(ctx.chat.id, message, {});
};

module.exports = { refCommandUtility };
