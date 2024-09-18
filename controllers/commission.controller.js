const Commission = require("../models/commission.model");
const userModel = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");

const create = asyncHandler(async (req, res, next) => {
  const { commission, level, status } = req.body;
  const result = await Commission.findOne({ level });
  if (result) {
    return res
      .status(409)
      .json(new ApiError(409, "Commission with level already exists"));
  }
  await Commission.create({
    createdBy: req.user._id,
    commission,
    level,
    status,
  });

  return res
    .status(201)
    .json(new ApiResponse(200, result, "Commission created successfully"));
});

const getAll = asyncHandler(async (req, res, next) => {
  const result = await Commission.find().populate("createdBy");
  return res.status(201).json(new ApiResponse(200, result, ""));
});

const getById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const result = await Commission.findById(id);
  if (!result) {
    return res
      .status(409)
      .json(new ApiError(409, "Commission does not exists"));
  }
  return res.status(201).json(new ApiResponse(200, result, ""));
});

const update = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { commission, level, status } = req.body;
  const result = await Commission.findById(id);
  if (!result) {
    return res
      .status(409)
      .json(new ApiError(409, "Commission does not exists"));
  }
  await Commission.findByIdAndUpdate(
    { _id: id },
    { commission, status, level },
  );

  return res
    .status(201)
    .json(new ApiResponse(200, result, "Commission created successfully"));
});

const deleteData = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const result = await Commission.findById(id);
  if (!result) {
    return res
      .status(409)
      .json(new ApiError(409, "Commission does not exists"));
  }
  await Commission.findByIdAndDelete({ _id: id });

  return res
    .status(201)
    .json(new ApiResponse(200, result, "Commission delete successfully"));
});

async function calculateTotalCommissionByLevel(user) {
  let totalCommission = 0;

  // Function to recursively traverse up the user tree and find the level
  async function findUserLevel(userId) {
    const parentUser = await userModel.findById(userId);
    if (!parentUser) return 0; // Assuming level 0 if user not found

    // If the user is an admin or doesn't have a level field, return 0
    if (parentUser.isAdmin || !parentUser.level) return 0;

    // Otherwise, return the level of the parent user
    return parentUser.level;
  }

  // Recursive function to calculate commission
  async function calculateCommission(userId) {
    const userLevel = await findUserLevel(userId);

    // Calculate commission based on user's level
    switch (userLevel) {
      case 1:
        totalCommission += user.commissionLevel1;
        break;
      case 2:
        totalCommission += user.commissionLevel2;
        break;
      // Add more cases for additional levels if needed
      default:
        break;
    }

    // Find the parent user (referrer) and continue calculating commission recursively
    if (userId !== user._id) {
      const parentUser = await userModel.findById(userId);
      if (parentUser && parentUser.referredBy) {
        await calculateCommission(parentUser.referredBy);
      }
    }
  }

  // Start calculating commission for the current user
  await calculateCommission(user._id);

  return totalCommission;
}

(async function getCommissionByLevel() {
  try {
    const users = await userModel.find({ isAdmin: false });
    // console.log("usersssssssss", users);

    // Loop through users
    for (const user of users) {
      // Calculate total commission for the user and their referred users
      const totalCommission = await calculateTotalCommissionByLevel(user);
    }
  } catch (error) {
    console.error(error);
    return new ApiError(400, "Error occurred while calculating commission.");
  }
})();

const updateCommission = asyncHandler(async (req, res, next) => {
  const { userId, earningId } = req.params;
  const user = await userModel.findById(userId);
  let sortedTotalEarning = user.totalEarnings.sort((a, b) => a.date - b.date);
  const earningIndex = sortedTotalEarning.findIndex(
    (earning) => earning._id.toString() === earningId,
  );

  console.log(sortedTotalEarning);

  if (earningIndex === -1) {
    return res.status(404).json({ error: "Earning not found" });
  }

  for (let i = 0; i <= earningIndex; i++) {
    sortedTotalEarning[i].isPaid = true;
  }
  await user.save();

  return res.status(200).json({
    message: "isPaid updated successfully",
    updatedEarnings: sortedTotalEarning,
  });
});

module.exports = {
  create,
  getAll,
  getById,
  update,
  deleteData,
  updateCommission,
};
