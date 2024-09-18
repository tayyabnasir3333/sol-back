const addressModel = require("../models/address.model");
const Address = require("../models/address.model");
const User = require("../models/user.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
require("dotenv").config();
const json2csv = require("json2csv").Parser;
const fs = require("fs");
const { getUserName } = require("../utils/getFullName");
const { bot } = require("../config/telegraf");
const commissionMiddleware = require("../middleware/commission.middleware");

const generateAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    await user.save({ validateBeforeSave: false });
    return { accessToken };
  } catch (error) {
    return res
      .status(500)
      .json(
        new ApiError(500, "Something went wrong while generating access token"),
      );
  }
};

const registerAdmin = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const existedUser = await User.findOne({
    email,
  });

  if (existedUser) {
    return res
      .status(409)
      .json(new ApiError(409, "User with email or username already exists"));
  }

  const user = await User.create(req.body);

  if (!user) {
    return res
      .status(500)
      .json(
        new ApiError(500, "Something went wrong while registering the user"),
      );
  }

  return res
    .status(201)
    .json(new ApiResponse(200, user, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return res.status(400).json(new ApiError(400, "User does not exist"));
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    return res.status(400).json(new ApiError(400, "Invalid user credentials"));
  }

  const { accessToken } = await generateAccessToken(user?._id);

  const loggedInUser = await User.findById(user?._id).select("-password");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, token: accessToken },
        "User logged in successfully",
      ),
    );
});

const allUsers = asyncHandler(async (req, res) => {
  const user = await User.find({ isAdmin: false });
  return res.status(200).json(new ApiResponse(200, user, "Users list"));
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);
  if (!user) {
    return res.status(400).json(new ApiError(400, "User does not exist"));
  }

  const delUser = await User.findByIdAndDelete(id);

  return res
    .status(200)
    .json(new ApiResponse(200, delUser, "Users deleted Successfully!"));
});

const registerUser = asyncHandler(async (req, res) => {
  console.log(req);
  const { id } = req.body;
  const existedUser = await User.findOne({
    id,
  });

  if (existedUser) {
    return res
      .status(409)
      .json(new ApiError(409, "User with email already exists"));
  }

  const user = await User.create(req.body);

  if (!user) {
    return res
      .status(500)
      .json(
        new ApiError(500, "Something went wrong while registering the user"),
      );
  }

  return res
    .status(201)
    .json(new ApiResponse(200, user, "User registered successfully"));
});

const registerBotUser = async (data, sponsor) => {
  try {
    const { id, first_name, last_name, username } = data;
    const user = await User.findOne({ telegramId: id });
    if (!user) {
      const user = await User.create({
        telegramId: id,
        fullName: first_name + " " + last_name,
        referralLink: `${id}`,
        referredBy: sponsor?._id,
        userName: username ? `@${username}` : first_name + " " + last_name,
      });
      await User.findByIdAndUpdate(sponsor?._id, {
        $push: { referredUsers: user._id },
      });
      return user;
    }
    return user;
  } catch (error) {
    console.log(error);
    return new ApiError(400, "");
  }
};

const buildTree = async (req, res) => {
  const { userId } = req.params;
  try {
    const tree = recursiveFunc(userId);
    res.json(tree);
  } catch (error) {
    throw error;
  }
};

async function recursiveFunc(userId) {
  const user = await User.findById(userId).populate("referredUsers");
  const tree = {
    user: user,
    referredUsers: [],
  };
  console.log(tree);
  for (const referredUser of user.referredUsers) {
    tree.referredUsers.push(await recursiveFunc(referredUser._id));
  }
  return tree;
}

const checkReferralCode = async (code) => {
  try {
    return await User.findOne({ referralLink: code });
  } catch (error) {
    return new ApiError(400, "");
  }
};

const checkUserByTId = async (telegramId) => {
  try {
    return await User.findOne({ telegramId });
  } catch (error) {
    return new ApiError(400, "");
  }
};

const createUserAddress = async (telegramId, address) => {
  if (address == process.env.ADMIN_ADDRESS) {
    throw Error("You cannot use this wallet address");
  }
  const user = await User.findOne({ telegramId });
  if (user) {
    const alreadyAddress = await Address.findOne({ address });
    if (alreadyAddress) {
      throw Error("Address already exists");
    }

    const addresses = await Address.find({ userId: user._id });
    const filterArr = addresses?.filter(
      (currentAdd) => currentAdd.address != address,
    );
    if (!filterArr.includes(address)) {
      await Address.create({
        userId: user._id,
        address: address,
        isActive: true,
        telegramId,
      });
      addresses.forEach(async (add) => {
        if (add.address !== address && add.isActive) {
          await Address.findByIdAndUpdate(add._id, { isActive: false });
        }
      });
    }
  }
};

const updateWalletAddress = async (telegramId, walletAddress) => {
  try {
    let address = await Address.findOne({ telegramId, isActive: true });

    if (!address) {
      address = new Address({
        telegramId,
        address: walletAddress,
        isActive: true,
      });
    } else {
      address.address = walletAddress;
    }
    await address.save();

    return address;
  } catch (error) {
    return new ApiError(400, "");
  }
};
const walletUserAmount = asyncHandler(async (req, res) => {
  const users = await User.find({ isAdmin: false });

  let returnArr = [];
  let paymentDate;
  await Promise.all(
    users.map(async (user) => {
      if (user?.totalEarnings?.length > 0) {
        let sortedTotalEarning = user.totalEarnings.sort(
          (a, b) => b.date - a.date,
        );

        const wallet = await addressModel.findOne({
          userId: user._id,
          isActive: true,
        });

        // console.log(sortedTotalEarning[0].date);
        if (!paymentDate)
          paymentDate = sortedTotalEarning?.find((data) => {
            return data.isPaid && data.date;
          })?.date;

        const totalEarnings = user.totalEarnings.reduce((sum, earning) => {
          if (!earning.isPaid) {
            const earningsValue = earning?.earnings;
            return sum + earningsValue;
          }
          return sum;
        }, 0);
        if (totalEarnings != 0) {
          return returnArr.push({
            wallet: wallet?.address,
            totalEarnings,
            user: user._id,
            sortedTotalEarning,
            earningId: sortedTotalEarning[0]?._id,
            date: paymentDate,
          });
        }
        return;
      }
    }),
  );

  const filename = "./public/data.csv";

  // Convert JSON to CSV using json2csv
  const json2csvParser = new json2csv({ fields: ["wallet", "totalEarnings"] });
  const csvData = json2csvParser.parse(returnArr);

  // Write CSV data to a file
  fs.writeFileSync(filename, csvData);
  const link = `${req.protocol}://${req.hostname}:${process.env.PORT}/data.csv`;

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { returnArr, link, paymentDate },
        "User wallet and total earning received successfully",
      ),
    );
});

const paidCommission = asyncHandler(async (req, res) => {
  const users = await User.find({ isAdmin: false });

  let returnArr = [];
  await Promise.all(
    users.map(async (user) => {
      if (user?.totalEarnings?.length > 0) {
        let sortedTotalEarning = user.totalEarnings.sort(
          (a, b) => a.date - b.date,
        );

        const totalEarnings = user.totalEarnings.reduce((sum, earning) => {
          if (earning.isPaid) {
            const earningsValue = earning?.earnings;
            return sum + earningsValue;
          }
          return sum;
        }, 0);

        const totalCommission = user.totalEarnings.reduce((sum, earning) => {
          if (earning.isPaid) {
            const earningsValue = earning?.commission;
            return sum + earningsValue;
          }
          return sum;
        }, 0);

        const months = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];

        if (totalEarnings != 0) {
          return returnArr.push({
            totalEarnings,
            totalCommission,
            user: user,
            date: `${new Date(
              sortedTotalEarning[0]?.date,
            ).getDate()} - ${new Date(
              sortedTotalEarning.slice(-1)[0]?.date,
            ).getDate()} ${
              months[new Date(sortedTotalEarning.slice(-1)[0]?.date).getMonth()]
            }`,
          });
        }
        return;
      }
    }),
  );

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { returnArr },
        "Paid Commission Received successfully",
      ),
    );
});

// const payTheCommission = asyncHandler(async (req, res) => {
//   const { id, sortedTotalEarning, totalEarnings } = req.body;
//   const user = await User.findById(id);

//   if (user?.totalEarnings?.length > 0) {
//     user.totalEarnings.map((earning, index) => {
//       sortedTotalEarning.map((sortTotalEarn, index) => {
//         if (earning?._id == sortTotalEarn?._id) {
//           earning.isPaid = true;
//         }
//       });
//     });
//   }

//   await User.findByIdAndUpdate(id, user);

//   const telegramId = user.telegramId;

//   let message = `
//   Congratulations ${user.userName}

//   <b>You just received a new comission</b>

//   💰 ${totalEarnings} $SOL
//   `;

//   await bot.telegram
//     .sendMessage(telegramId, message, {
//       parse_mode: "HTML",
//     })
//     .then(() =>
//       console.log("Commission paid message sent to user in Telegram!"),
//     )
//     .catch((err) => {
//       console.error("Error sending message:", err);
//     });

//   return res
//     .status(201)
//     .json(new ApiResponse(200, {}, "Commission Paid Successfully!"));
// });

const payTheCommission = asyncHandler(async (req, res) => {
  try {
    const { returnArr } = req.body;

    await Promise.all(
      returnArr.map(async (returnData) => {
        const user = await User.findById(returnData.user);

        if (user && user.totalEarnings.length > 0) {
          user.totalEarnings.forEach((earning) => {
            returnData.sortedTotalEarning.forEach((sortTotalEarn) => {
              if (earning._id.toString() === sortTotalEarn._id.toString()) {
                earning.isPaid = true;
              }
            });
          });

          await User.findByIdAndUpdate(returnData.user, user);

          const telegramId = user.telegramId;

          let message = `
          Congratulations ${user.userName}

<b>You just received a new commission</b>

💰 ${returnData.totalEarnings} $SOL
        `;

          await bot.telegram.sendMessage(telegramId, message, {
            parse_mode: "HTML",
          });

          console.log("Commission paid message sent to user in Telegram!");
        }
      }),
    );

    return res
      .status(201)
      .json(new ApiResponse(200, {}, "Commission Paid Successfully!"));
  } catch (error) {
    console.error("Error paying commission:", error);
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Error while paying commission:"));
  }
});

const updateComissionServed = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const { commissionServed } = req.body;

  const result = await User.findById(id);
  if (!result) {
    return res.status(409).json(new ApiError(409, "User does not exists"));
  }
  await User.findOneAndUpdate({ _id: id }, { commissionServed });

  return res
    .status(201)
    .json(new ApiResponse(200, {}, "Affiliation updated successfully"));
});

module.exports = {
  registerAdmin,
  registerUser,
  allUsers,
  loginUser,
  registerBotUser,
  buildTree,
  checkReferralCode,
  createUserAddress,
  checkUserByTId,
  updateWalletAddress,
  walletUserAmount,
  paidCommission,
  payTheCommission,
  deleteUser,
  updateComissionServed,
};
