const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/user.model");
const ApiResponse = require("../utils/ApiResponse");
const commissionModel = require("../models/commission.model");

const getLevels = asyncHandler(async (req, res) => {
  const { id, level } = req.params;
  const targetLevel = parseInt(level);

  if (isNaN(targetLevel) || targetLevel < 1) {
    return res.status(400).json(new ApiResponse(400, null, "Invalid level"));
  }

  // Function to recursively get downline users up to the target level
  const getUserDownline = async (userId, currentLevel = 1) => {
    const user = await User.findById(userId).populate("referredUsers");

    if (!user || currentLevel > targetLevel) {
      return null;
    }

    const downline = {
      _id: user._id,
      fullName: user.fullName,
      telegramId: user.telegramId,
      referralLink: user.referralLink,
      isAdmin: user.isAdmin,
      referredUsers: level == 1 ? user.referredUsers : [],
    };

    if (currentLevel < targetLevel) {
      for (const referredUser of user.referredUsers) {
        const downlineUser = await getUserDownline(
          referredUser._id,
          currentLevel + 1,
        );
        if (downlineUser) {
          downline.referredUsers.push(downlineUser);
        }
      }
    }

    return downline;
  };

  // Get downline users starting from the specified user ID
  const downline = await getUserDownline(id);

  if (!downline) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "User or level not found"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { referredUsers: downline },
        `Downline users at level ${targetLevel}`,
      ),
    );
});

const getUserLevels = asyncHandler(async (req, res) => {
  try {
    const usersWithLevels = await getUsersWithLevels(req.params.id);
    return res.status(200).json(new ApiResponse(200, usersWithLevels));
  } catch (error) {
    console.error("Error:", error);
  }
});

async function getUsersWithLevels(userId, level = 0) {
  const usersWithLevels = [];

  // Find the user document
  const user = await User.findById(userId);

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

async function getReverseUserDownline(userId) {
  const data = await getUsersWithLevels(userId);
  const levelCommission = await commissionModel.find();
  const groupedUsers = groupUsersByLevel(data, levelCommission);

  return groupedUsers;
}

function groupUsersByLevel(data, levelCommission) {
  const groupedUsers = [];

  data.forEach((item) => {
    const level = item.level;
    const commission = levelCommission.find((com) => com.level == level);
    if (!groupedUsers[level]) {
      groupedUsers[level] = {
        level: level,
        commission: commission?.commission,
        users: [],
      };
    }
    groupedUsers[level].users.push(item.user);
  });

  return groupedUsers.filter(Boolean).sort((a, b) => b.level - a.level); // Filter out undefined entries and sort in descending order by level
}

async function getSponsorsWithLevels(userId, level = 1) {
  const sponsorsWithLevels = [];

  // Find the user document
  const user = await User.findById(userId);

  if (!user || !user.referredBy) {
    return sponsorsWithLevels; // User not found or no sponsor
  }

  // Find the sponsor document
  const sponsor = await User.findById(user.referredBy);
  if (!sponsor) {
    return sponsorsWithLevels; // Sponsor not found
  }

  // Add the sponsor and their level to the result
  sponsorsWithLevels.push({ sponsor, level });

  // If the sponsor has a sponsor, recursively find sponsors with levels for each sponsor
  const sponsorSponsorsWithLevels = await getSponsorsWithLevels(
    sponsor._id,
    level + 1,
  );
  sponsorsWithLevels.push(...sponsorSponsorsWithLevels);

  return sponsorsWithLevels;
}

async function getReverseUserSponsorChain(userId) {
  const sponsorsWithLevels = await getSponsorsWithLevels(userId);
  const levelCommission = await commissionModel.find();
  const groupedSponsors = groupSponsorsByLevel(sponsorsWithLevels);

  groupedSponsors.map((data, index) => {
    const commission = levelCommission.find((com) => com.level === index + 1);
    data.commission = commission?.commission;
    data.level = index + 1;
  });
  // console.log("sponsor.... ", groupedSponsors);
  return groupedSponsors;
}

function groupSponsorsByLevel(sponsorsWithLevels) {
  const groupedSponsors = [];

  sponsorsWithLevels.forEach((item) => {
    const level = item.level;
    if (!groupedSponsors[level]) {
      groupedSponsors[level] = {
        level: level,
        sponsors: [],
      };
    }
    groupedSponsors[level].sponsors.push(item.sponsor);
  });

  return groupedSponsors.filter(Boolean).sort((a, b) => b.level - a.level); // Filter out undefined entries and sort in descending order by level
}

module.exports = {
  getLevels,
  getUserLevels,
  getReverseUserDownline,
  getReverseUserSponsorChain,
};
