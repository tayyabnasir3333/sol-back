const express = require("express");
require("./config/database")();
require("dotenv").config();
const fs = require("fs");
const http = require("http");
const EventEmitter = require("events");
const eventEmitter = new EventEmitter();
const { createWallet, getBalance, sendSol } = require("./utils/wallet");
const authRoute = require("./routes/auth.route");
const commissionRoute = require("./routes/commission.route");
const pricingRoute = require("./routes/pricing.route");
const advertisementRoute = require("./routes/advertisement.route");
const notificationRoute = require("./routes/notification.route");
const levelRoute = require("./routes/level.route");
const app = express();
const { Telegraf, Markup } = require("telegraf");
// const bot = new Telegraf(process.env.BOT_TOKEN);
const cors = require("cors");
const {
  registerBotUser,
  checkReferralCode,
  createUserAddress,
  checkUserByTId,
  updateWalletAddress,
} = require("./controllers/auth.controller");
const walletModel = require("./models/wallet.model");
const {
  getReverseUserDownline,
  getReverseUserSponsorChain,
} = require("./controllers/level.controller");
const userModel = require("./models/user.model");
const pricingModel = require("./models/pricing.model");
const advertisementModel = require("./models/advertisement.model");
const asyncHandler = require("./utils/asyncHandler");
const {
  getTokenInfo,
  getOwnerInfo,
  isValidSolanaAddress,
} = require("./utils/tokenInfo");
const ApiResponse = require("./utils/ApiResponse");
const { bot } = require("./config/telegraf");
const { default: axios } = require("axios");
const { uploadFile, getPreSignedUrl } = require("./utils/s3.service");
const { randomUUID } = require("crypto");
const { createNewWalletToDB } = require("./controllers/wallet.controller");
const transactionModel = require("./models/transaction.model");
const addressModel = require("./models/address.model");
const { getFullName, getUserName } = require("./utils/getFullName");
const { getTransactionsBackend } = require("./utils/getTransactionBackend");
const { postAlwaysApprove } = require("./utils/postAutoApprove");
const publishedPostCron = require("./telegram.js/cronjob");

const id = "65fbdce15805861a76e3a847";

// Middleware
app.use(express.json());
app.use(cors({ origin: "*" }));
// Error handling middleware
// Middleware to serve static files (like images)
app.use(express.static("public"));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Routes
app.use("/api/v1/auth", authRoute);
app.use("/api/v1/commission", commissionRoute);
app.use("/api/v1/pricing", pricingRoute);
app.use("/api/v1/advertisement", advertisementRoute);
app.use("/api/v1/levels", levelRoute);
app.use("/api/v1/notification", notificationRoute);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  publishedPostCron();
});

const commands = [
  { command: "start", description: "Start the bot" },
  { command: "/call", description: "Interact bot to know about promotions" },
  { command: "ref", description: "Interact with bot to know your ref address" },
];

bot.telegram.setMyCommands(commands);

const sessions = {};

const startCommand = async (ctx) => {
  try {
    if (ctx.chat.type === "supergroup") {
      const userId = ctx.from.id;
      const type = ctx.chat.type;
      console.log("chat========>:", type, userId);
      ctx.telegram.sendMessage(
        userId,
        `Continue in private group. Click here /start`,
      );
      return;
    }
    console.log("ssssssssssssSS", ctx.from);
    const referralCode = ctx.payload;
    const { first_name, last_name } = ctx.from;
    const fullName = first_name + " " + last_name;
    let sponsor;
    if (referralCode) {
      sponsor = await checkReferralCode(referralCode);
    }
    const user = await userModel.findOne({ telegramId: ctx.from.id });
    if (user) {
      const msg = `You have registered already. Use the /ref command to get your affiliate link and start earning from your network.

  Press “Make a Call” to post your first call!
  Press “My Reflink” to earn 40% commission promoting me.`;
      const { id } = ctx.from;
      ctx.replyWithMarkdownV2(msg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🦧 Make a Call", callback_data: "makeACall" }],
            [{ text: "🌎 Website", callback_data: "myWebsite" }],
            [{ text: "🔗 My Reflink", callback_data: "myRef" }],
            [{ text: "💴 My Balance", callback_data: "myBalance" }],
            [{ text: "🥳 My Network", callback_data: "myNetwork" }],
            [{ text: "💳 Change Wallet", callback_data: "changeWallet" }],
          ],
        },
      });
      return;
    }
    await registerBotUser(ctx.from, sponsor);

    await ctx.replyWithMarkdown(
      `Welcome ${
        ctx.from.username ? `@${getUserName(ctx)}` : `${getFullName(ctx)}`
      }.
  I'm ${ctx.botInfo.first_name}.
  I'll assist you in spreading your token Calls
  to thousands of degens 🦧

  ${sponsor ? "Your sponsor is: " + sponsor.fullName : ""}

  To continue, please accept the <a href="https://apeavenue.org/terms-and-conditions/">Terms and Conditions</a>`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [[{ text: "Accept", callback_data: "accept" }]],
        },
      },
    );
  } catch (error) {
    console.log(
      "=============start command catch block=============",
      error?.message,
    );
  }
};

bot.command("start", startCommand);

const myBalance = async (ctx) => {
  try {
    const user = await userModel.findOne({ telegramId: ctx.from.id });
    if (!user) {
      await ctx.reply(
        "We did not find any user while fetching Balance, Please try again!",
      );
      return;
    }

    const totalEarningsSum = user.totalEarnings?.reduce(
      (acc, curr) => acc + curr.earnings,
      0,
    );

    await ctx.reply(`Your total balance is: ${totalEarningsSum}`);
  } catch (error) {
    console.log(
      "=============My Balance catch block=============",
      error?.message,
    );
  }
};

const refCommandUtility = async (ctx) => {
  try {
    const user = await checkUserByTId(ctx.from.id);
    if (!user) {
      await ctx.reply("We did not find any user, Please try again!");
      return;
    }
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
    let message = `Your affiliate link is: "<code>${process.env.REFERRAL_LINK}?start=${user?.referralLink}</code>"\n`;
    message += `Your network is made up of ${downline.length - 1} users\n`;
    Object.keys(levelCounts).forEach((level) => {
      if (level !== "0") {
        // Exclude the 0th level
        message += `${levelCounts[level]} users in level ${level}\n`;
      }
    });
    bot.telegram.sendMessage(ctx.chat.id, message, {
      parse_mode: "HTML",
    });
  } catch (error) {
    console.log(
      "=============refCommandUtility catch block=============",
      error?.message,
    );
  }
};

// Bot Ref Command
bot.command("ref", refCommandUtility);

bot.command("balance", async (ctx) => {
  try {
    const user = await checkUserByTId(ctx.from.id);
    if (!user) {
      await ctx.reply("We did not find any user, Please try again!");
      return;
    }
    const message = `This week you earned: $123 So far you have generated a total of: $234 $100 from the 1° line $134 from the 2° line`;
    const fileName = "earnings.pdf";
    generatePDF(fileName, message);
    await ctx
      .replyWithDocument(
        { source: fileName },
        {
          caption: message,
        },
      )
      .then(() => {
        fs.unlinkSync(fileName);
      })
      .catch((err) => {});
    // bot.telegram.sendMessage(ctx.chat.id, message, {});
    await ctx.replyWithMarkdown(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Print Earnings", callback_data: "printEarnings" }],
        ],
      },
    });
  } catch (error) {
    console.log(
      "=============balance catch block=============",
      error?.message,
    );
  }
});

const changeWallet = async (ctx) => {
  const user = await userModel.findOne({ telegramId: ctx.from.id });
  if (!user) {
    await ctx.reply("We did not find any user, Please try again!");
    return;
  }

  await ctx.replyWithMarkdown(
    "To change the wallet, send me your wallet address",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Enter your new wallet", callback_data: "walletAddress" }],
        ],
      },
    },
  );
};

bot.command("wallet", changeWallet);

const handlePromo = async (ctx) => {
  console.log("pppppppppppppppp", ctx.from);
  if (ctx.chat.type == "private") {
    const userId = ctx.from.id;
    const type = ctx.chat.type;
    console.log("chat========>:", type, userId);
    ctx.telegram.sendMessage(
      userId,
      `Welcome to ${ctx.botInfo.username}. I will assist you in publishing your sponsored post. Confirm acceptance of terms and condition`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Confirm", callback_data: "solanaAddress" }],
          ],
        },
      },
    );
    return;
  }
  await ctx.replyWithMarkdownV2(
    "To book a sponsored promotion, click on the following button",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Continue ${
                ctx.chat.type == "supergroup" ? "Privately" : ""
              }`,
              callback_data: "continuePrivately",
            },
          ],
        ],
      },
    },
  );
};

bot.command("call", handlePromo);

bot.action("accept", (ctx) => {
  ctx.reply("To complete the registration, send me your wallet:", {
    reply_markup: {
      force_reply: true,
    },
  });
});

bot.action("continuePrivately", (ctx) => {
  try {
    const userId = ctx.from.id;
    const type = ctx.chat.type;
    console.log("chat========>:", type, userId);
    // if (type == "supergroup") return;
    // Start a private chat with the user
    ctx.telegram.sendMessage(
      userId,
      `Welcome to ${ctx.botInfo.username}. I will assist you in publishing your sponsored post. Confirm acceptance of terms and condition`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Confirm", callback_data: "solanaAddress" }],
          ],
        },
      },
    );

    // Reply to the original message to acknowledge the action
    ctx.answerCbQuery();
  } catch (error) {
    console.log("privateeeeeee errorrrrrrrr", error);
  }
});

bot.action("solanaAddress", (ctx) => {
  ctx.reply("Send me your token contract address on Solana", {
    reply_markup: {
      force_reply: true,
    },
  });
});

bot.action("walletAddress", async (ctx) => {
  ctx.reply("To change the wallet, send me your wallet address:", {
    reply_markup: {
      force_reply: true,
    },
  });
});

bot.action("confirmWallet", async (ctx) => {
  ctx.reply("To change the wallet, send me your wallet address:", {
    reply_markup: {
      force_reply: true,
    },
  });
});

bot.action("makeACall", async (ctx) => {
  handlePromo(ctx);
});

bot.action("myWebsite", async (ctx) => {
  ctx.reply(
    `${ctx.from.username ? `@${getUserName(ctx)}` : `${getFullName(ctx)}`}

visit <a href="apeavenue.org">apeavenue.org</a> for more info about ourproject and tokenomics. For Terms and Conditions visit https://apeavenue.org/terms-and-conditions
Thank you.`,
    { parse_mode: "HTML" },
  );
});

bot.action("myRef", async (ctx) => {
  try {
    const user = await checkUserByTId(ctx.from.id);
    if (!user) {
      await ctx.reply("We did not find any user, Please try again!");
      return;
    }
    let msg = `Your affiliate link is: "<code>${process.env.REFERRAL_LINK}?start=${user?.referralLink}</code>"\n`;
    ctx.reply(msg, {
      parse_mode: "HTML",
    });
  } catch (error) {
    console.log("=============myRef catch block=============", error?.message);
  }
});

bot.action("backBtn", startCommand);

bot.action("myBalance", myBalance);
bot.action("myNetwork", refCommandUtility);
bot.action("changeWallet", changeWallet);

bot.action(/^sendObject_(.*)$/, async (ctx) => {
  try {
    const objectId = ctx.match[1]; // Extract object ID from callback data
    const wallet = await walletModel.findById(objectId);
    if (!wallet) {
      ctx.reply("Wallet not found, please try again!");
      return;
    }
    const address = await addressModel.findOne({
      telegramId: ctx.from.id,
      isActive: true,
    });
    if (!address) {
      ctx.reply("Wallet not found, please try again!");
      return;
    }

    const createdAtTime = new Date(wallet.createdAt).getTime();
    const currentTime = Date.now();
    const fifteenMinutesInMilliseconds = 15 * 60 * 1000; // 15 minutes in milliseconds
    console.log("wwwwwwwww", new Date(currentTime));
    const advertisement = await advertisementModel
      .findById(sessions[ctx.from.id]?.advertisementId)
      .populate("pricingId");
    if (!advertisement) {
      ctx.reply("Advertisement not found, please try again by creating new!");
      return;
    }
    if (currentTime - createdAtTime > fifteenMinutesInMilliseconds) {
      const transferFunction = await sendSol(
        wallet.secretKey,
        address.address,
        advertisement.pricingId.price,
        ctx.from.id,
        true,
      );
      await advertisementModel.findByIdAndDelete(
        sessions[ctx.from.id].advertisementId,
      );
      ctx.reply("Transaction rejected: 15 minutes time limit exceeded.");
      return;
    }

    try {
      const transferFunction = await sendSol(
        wallet.secretKey,
        process.env.ADMIN_ADDRESS,
        advertisement.pricingId.price,
        ctx.from.id,
        false,
      );

      const backendHash = await getTransactionsBackend(wallet.publicKey);

      console.log("timeeeeeeeeeeeeee", transferFunction);

      const user = await userModel.findOne({ telegramId: ctx.from.id });

      // Transaction record
      await transactionModel.create({
        userId: user._id,
        walletId: wallet._id,
        advertisementId: sessions[ctx.from.id].advertisementId,
        price: transferFunction.sendAmount,
        date: new Date(Date.now()),
        tranxHash: `https://solscan.io/tx/${transferFunction.signature}`,
        tranxHashBackend: `https://solscan.io/tx/${backendHash[1]}`,
      });
      if (sessions[ctx.from.id]) {
        const payment = {
          recieptAmount: transferFunction.sendAmount,
          status: "Paid",
        };
        if (user?.isAlwaysApproved == true)
          postAlwaysApprove(sessions[ctx.from.id].advertisementId);
        await advertisementModel.findByIdAndUpdate(
          sessions[ctx.from.id].advertisementId,
          {
            payment,
          },
        );
      }
      const sponsorUsers = await getReverseUserSponsorChain(user._id);
      for (const sponsorUser of sponsorUsers) {
        console.log(">>>>>>>>>>>>>>>>> ", sponsorUser);
        console.log(">>>>>>>>>>>>>>>>> comm ", sponsorUser.commission);
        console.log(
          ">>>>>>>>>>>>>>>>> commm Ser  ",
          sponsorUser.sponsors[0].commissionServed,
        );
        if (sponsorUser.commission !== undefined) {
          // Make sure commission is defined
          const commissionPer = sponsorUser.commission / 100;
          const earnings = transferFunction?.sendAmount * commissionPer; // Calculate earnings
          console.log(transferFunction?.sendAmount, commissionPer, earnings);
          // Update totalEarnings array for the sponsor user
          try {
            if (sponsorUser?.sponsors[0].commissionServed)
              await userModel.findByIdAndUpdate(sponsorUser?.sponsors[0]?._id, {
                $push: {
                  totalEarnings: {
                    userId: user._id,
                    commission: parseInt(sponsorUser.commission),
                    earnings: earnings,
                    level: sponsorUser?.level,
                    date: new Date(Date.now()),
                  },
                },
              });
          } catch (error) {
            console.log("rrrrrrrrrrrrrrr", error);
          }
        }
      }
      // console.log("transferFunction", sponsorUsers);
      const msg = `Congratulations ${
        ctx.from.username ? `@${getUserName(ctx)}` : `${getFullName(ctx)}`
      }

    ✅ Payment confirmed!

    Your post will be published soon, after approval.
    `;

      ctx.replyWithMarkdownV2(msg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🦧 Make a new Call", callback_data: "makeACall" }],
            [{ text: "🔗 Invite Friends", callback_data: "myRef" }],
            [{ text: "Back", callback_data: "backBtn" }],
          ],
        },
      });

      // if (user.isAlwaysApproved) {
      //   postAlwaysApprove(sessions[ctx.from.id].advertisementId);
      // }
    } catch (error) {
      console.log("errrrrrrrrrrrr", error);
      if (error == "Error: lowAmount") {
        ctx.reply(
          ` After sending the payment, please tap on 'Check Payment' again after a few seconds 🐒`,
          Markup.inlineKeyboard([
            Markup.button.callback("Check Payment", `sendObject_${wallet._id}`),
          ]),
        );
        return;
      }
      ctx.reply(
        `No payment received\n\nWait few seconds`,
        Markup.inlineKeyboard([
          Markup.button.callback("Check Payment", `sendObject_${wallet._id}`),
        ]),
      );
    }
  } catch (error) {
    console.log(
      "=============Payment time validity catch block=============",
      error?.message,
    );
  }
});

bot.action(/^publicationButton_(.*)$/, async (ctx) => {
  try {
    const objectId = ctx.match[1];
    // if v2 occurs just remove 302 to 311 lines and uncomment 312 line
    const data = await pricingModel.findById(objectId);
    if (!data) {
      await ctx.reply("We did not find pricing data, Please try again!");
      return;
    }
    if (sessions[ctx.from.id]) {
      await advertisementModel.findByIdAndUpdate(
        sessions[ctx.from.id].advertisementId,
        {
          pricingId: objectId,
        },
      );
    }
    await confirmPayment(ctx, data.price);
    // await displayExtraServices(ctx, objectId);
  } catch (error) {
    console.log(
      "=============publicationButton_ catch block=============",
      error?.message,
    );
  }
});

bot.action(/^noThanks_(.*)$/, async (ctx) => {
  try {
    // for v2
    const objectId = ctx.match[1]; // Extract object ID from callback data
    const data = await pricingModel.findById(objectId);
    if (!data) {
      await ctx.reply("We did not find pricing data, Please try again!");
      return;
    }
    if (sessions[ctx.from.id]) {
      await advertisementModel.findByIdAndUpdate(
        sessions[ctx.from.id].advertisementId,
        {
          pricingId: objectId,
        },
      );
    }
    await confirmPayment(ctx, data.price);
  } catch (error) {
    console.log(
      "=============noThanks_ catch block=============",
      error?.message,
    );
  }
});

bot.on("photo", async (ctx) => {
  try {
    if (
      ctx.message?.reply_to_message?.text ==
      "Send me media: Photos, Videos, Gifs"
    ) {
      //initial check for advert session
      const advertisement = await advertisementModel.findById(
        sessions[ctx.from.id]?.advertisementId,
      );
      if (!advertisement) {
        ctx.reply("Advertisement not found, please try again by creating new!");
        return;
      }

      const photo = ctx.message.photo;
      const photoId = photo[photo.length - 1].file_id;
      const file = await ctx.telegram.getFile(photoId);
      // const fileStream = await ctx.telegram.getFileStream(photoId);

      const photoUrl = `http://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      console.log("Received photo URL:", photoUrl);
      let fileRes;
      try {
        const response = await axios.get(photoUrl, {
          responseType: "arraybuffer", // Ensure binary response
        });
        const buffer = Buffer.from(response.data);
        // Pipe the image stream to the file stream
        // response.data.pipe(fileStream);
        fileRes = await uploadFile(
          buffer,
          randomUUID(),
          "wfs-pg",
          "image/jpeg",
        );
        console.log("fileeeeeeeeeeeeeee", fileRes.uuid);
        console.log("Photo uploaded to S3 successfully.");
        console.log(sessions[ctx.from.id]);
        if (sessions[ctx.from.id]) {
          await advertisementModel.findByIdAndUpdate(
            sessions[ctx.from.id].advertisementId,
            {
              $push: {
                attachments: {
                  link: file.file_path,
                  uuid: fileRes.uuid,
                },
              },
            },
          );
        }
      } catch (error) {
        console.error("Error handling image:", error);
      }

      eventEmitter.emit("mediaReceived", photoUrl, ctx);
    }
    // if (ctx.message?.reply_to_message?.text == undefined) {
    //   ctx.reply("Send me media: Photos, Videos, Gifs", {
    //     reply_markup: {
    //       force_reply: true,
    //     },
    //   });
    // }
  } catch (error) {
    console.log(
      "=============Photo Upload catch block=============",
      error?.message,
    );
  }
});

bot.on("animation", async (ctx) => {
  try {
    if (
      ctx.message?.reply_to_message?.text ==
      "Send me media: Photos, Videos, Gifs"
    ) {
      //initial check for advert session
      const advertisement = await advertisementModel.findById(
        sessions[ctx.from.id]?.advertisementId,
      );
      if (!advertisement) {
        ctx.reply("Advertisement not found, please try again by creating new!");
        return;
      }

      const animation = ctx.message.animation;
      const animationId = animation.file_id;
      const file = await ctx.telegram.getFile(animationId);

      const animationUrl = `http://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      console.log("Received animation URL:", animationUrl);
      let fileRes;
      try {
        const response = await axios.get(animationUrl, {
          responseType: "arraybuffer",
        });
        const buffer = Buffer.from(response.data);
        fileRes = await uploadFile(buffer, randomUUID(), "wfs-pg", "image/gif");
        console.log("fileeeeeeeeeeeeeee", fileRes.uuid);
        console.log("Photo uploaded to S3 successfully.");
        console.log(sessions[ctx.from.id]);
        if (sessions[ctx.from.id]) {
          await advertisementModel.findByIdAndUpdate(
            sessions[ctx.from.id].advertisementId,
            {
              $push: {
                animations: {
                  link: file.file_path,
                  uuid: fileRes.uuid,
                },
              },
            },
          );
        }
      } catch (error) {
        console.error("Error handling animation:", error);
      }
      eventEmitter.emit("mediaReceived", animationUrl, ctx);
    }
    // if (ctx.message?.reply_to_message?.text == undefined) {
    //   ctx.reply("Send me media: Photos, Videos, Gifs", {
    //     reply_markup: {
    //       force_reply: true,
    //     },
    //   });
    // }
  } catch (error) {
    console.log(
      "=============Animation Upload catch block=============",
      error?.message,
    );
  }
});

bot.on("video", async (ctx) => {
  try {
    if (
      ctx.message?.reply_to_message?.text ==
      "Send me media: Photos, Videos, Gifs"
    ) {
      //initial check for advert session
      const advertisement = await advertisementModel.findById(
        sessions[ctx.from.id]?.advertisementId,
      );
      if (!advertisement) {
        ctx.reply("Advertisement not found, please try again by creating new!");
        return;
      }

      const video = ctx.message.video;
      const videoId = video.file_id;
      const file = await ctx.telegram.getFile(videoId);

      const videoUrl = `http://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
      console.log("Received video URL:", videoUrl);
      let fileRes;
      try {
        const response = await axios.get(videoUrl, {
          responseType: "arraybuffer",
        });
        const buffer = Buffer.from(response.data);
        fileRes = await uploadFile(buffer, randomUUID(), "wfs-pg", "video/mp4");
        console.log("fileeeeeeeeeeeeeee", fileRes.uuid);
        console.log("Photo uploaded to S3 successfully.");
        console.log(sessions[ctx.from.id]);
        if (sessions[ctx.from.id]) {
          await advertisementModel.findByIdAndUpdate(
            sessions[ctx.from.id].advertisementId,
            {
              $push: {
                videos: {
                  link: file.file_path,
                  uuid: fileRes.uuid,
                },
              },
            },
          );
        }
      } catch (error) {
        console.error("Error handling video:", error);
      }
      eventEmitter.emit("mediaReceived", videoUrl, ctx);
    }
    // if (ctx.message?.reply_to_message?.text == undefined) {
    //   ctx.reply("Send me media: Photos, Videos, Gifs", {
    //     reply_markup: {
    //       force_reply: true,
    //     },
    //   });
    // }
  } catch (error) {
    console.log(
      "=============Video Upload catch block=============",
      error?.message,
    );
  }
});

bot.on("message", async (ctx) => {
  if (ctx.from.id)
    if (
      ctx.message.reply_to_message &&
      ctx.message.reply_to_message.text ==
        "To complete the registration, send me your wallet:"
    ) {
      try {
        const msg = `Registration completed.

Your wallet is:
${ctx.message.text}

Press “Make a Call” to post your first call!
Press “My Reflink” to earn 40% commission promoting me.`;
        const isValid = isValidSolanaAddress(ctx.message.text);
        if (!isValid) {
          ctx.reply("To complete the registration, send me your wallet:", {
            reply_markup: {
              force_reply: true,
            },
          });
          return;
        }

        const { id } = ctx.from;
        await createUserAddress(id, ctx.message.text);
        ctx.replyWithMarkdownV2(msg, {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "🦧 Make a Call", callback_data: "makeACall" }],
              [{ text: "🌎 Website", callback_data: "myWebsite" }],
              [{ text: "🔗 My Reflink", callback_data: "myRef" }],
              [{ text: "💴 My Balance", callback_data: "myBalance" }],
              [{ text: "🥳 My Network", callback_data: "myNetwork" }],
              [{ text: "💳 Change Wallet", callback_data: "changeWallet" }],
            ],
          },
        });
      } catch (error) {
        console.log(
          "error while ==> To complete the registration, send me your wallet:",
        );
      }
    }
  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.text ===
      "To change the wallet, send me your wallet address:"
  ) {
    try {
      const walletAddress = ctx.message.text;
      const isValid = isValidSolanaAddress(walletAddress);
      if (!isValid) {
        ctx.reply("To change the wallet, send me your wallet address:", {
          reply_markup: {
            force_reply: true,
          },
        });
        return;
      }
      await updateWalletAddress(ctx.from.id, walletAddress);
      await ctx.reply(`Your new wallet has been successfully changed`);
    } catch (error) {
      console.log(
        "error while ==> To change the wallet, send me your wallet address:",
        error?.message,
      );
    }
  }
  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.text ==
      "Send me your token contract address on Solana"
  ) {
    const user = await userModel.findOne({ telegramId: ctx.from.id });
    if (!user) {
      await ctx.reply(
        "You need to register first to proceed. Use the /start command to begin the registration process.",
      );
      return;
    }

    try {
      const isValid = await getOwnerInfo(ctx.message.text);
      const {
        tokenInfo,
        holders,
        freezeAuthority,
        mintAuthority,
        poolInfo,
        transferFee,
        age,
      } = await getTokenInfo(ctx.message.text);
      const add = await advertisementModel.create({
        userId: user.id,
        solanaAddress: ctx.message.text,
      });
      sessions[ctx.from.id] = { advertisementId: add._id };
      eventEmitter.emit("solanaAddress", ctx.message.text, ctx);
    } catch (error) {
      console.log("eeeeeeeeeeee", error);
      if (
        error ==
        "TypeError: Cannot destructure property 'tokenInfo' of '(intermediate value)' as it is undefined."
      ) {
        // await ctx.reply(
        //   "There is issue in fetching data in your contract address on Solana",
        // );
        ctx.telegram.sendMessage(
          ctx.from.id,
          `There is issue in fetching data in your contract address on Solana. Please enter your another contract address on Solana`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Confirm", callback_data: "solanaAddress" }],
              ],
            },
          },
        );
        return;
      }
      // await ctx.reply("Invalid Contract Address");
      ctx.telegram.sendMessage(
        ctx.from.id,
        `Invalid Contract Address. Please enter your contract address on Solana again`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Confirm", callback_data: "solanaAddress" }],
            ],
          },
        },
      );
    }
  }
  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.text ==
      "Send me your project's description. (max 520 characters)"
  ) {
    try {
      //initial check for advert session
      const advertisement = await advertisementModel.findById(
        sessions[ctx.from.id]?.advertisementId,
      );
      if (!advertisement) {
        ctx.reply("Advertisement not found, please try again by creating new!");
        return;
      }

      let descriptionText = ctx.message.text;

      if (descriptionText.length > 520) {
        await ctx.reply(
          "You've entered more than 520 characters. Please limit your description to 520 characters.",
        );
        ctx.reply("Send me your project's description. (max 520 characters)", {
          reply_markup: {
            force_reply: true,
          },
        });
        return;
      }
      if (sessions[ctx.from.id]) {
        await advertisementModel.findByIdAndUpdate(
          sessions[ctx.from.id].advertisementId,
          {
            text: ctx.message.text,
          },
        );
      }

      eventEmitter.emit("descriptionReceived", ctx.message.text, ctx);
    } catch (error) {
      console.log(
        "error while ==> Send me your project's description. (max 520 characters):",
        error?.message,
      );
    }
  }
  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.text == "Send me your project's website link"
  ) {
    try {
      //initial check for advert session
      const advertisement = await advertisementModel.findById(
        sessions[ctx.from.id]?.advertisementId,
      );
      if (!advertisement) {
        ctx.reply("Advertisement not found, please try again by creating new!");
        return;
      }

      if (sessions[ctx.from.id]) {
        await advertisementModel.findByIdAndUpdate(
          sessions[ctx.from.id].advertisementId,
          {
            websiteLink: ctx.message.text,
          },
        );
      }
      eventEmitter.emit("websiteLink", ctx.message.text, ctx);
    } catch (error) {
      console.log(
        "error while ==> Send me your project's website link",
        error?.message,
      );
    }
  }
  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.text ==
      "Send me your project's telegram portal portal link"
  ) {
    try {
      //initial check for advert session
      const advertisement = await advertisementModel.findById(
        sessions[ctx.from.id]?.advertisementId,
      );
      if (!advertisement) {
        ctx.reply("Advertisement not found, please try again by creating new!");
        return;
      }

      if (sessions[ctx.from.id]) {
        await advertisementModel.findByIdAndUpdate(
          sessions[ctx.from.id].advertisementId,
          {
            telegramLink: ctx.message.text,
          },
        );
      }
      eventEmitter.emit("twitterLink", ctx.message.text, ctx);
    } catch (error) {
      console.log(
        "error while ==> Send me your project's telegram portal portal link",
        error?.message,
      );
    }
  }
  if (
    ctx.message.reply_to_message &&
    ctx.message.reply_to_message.text == "Send me your project's twitter link"
  ) {
    try {
      //initial check for advert session
      const advertisement = await advertisementModel.findById(
        sessions[ctx.from.id]?.advertisementId,
      );
      if (!advertisement) {
        ctx.reply("Advertisement not found, please try again by creating new!");
        return;
      }

      if (sessions[ctx.from.id]) {
        await advertisementModel.findByIdAndUpdate(
          sessions[ctx.from.id].advertisementId,
          {
            twitterLink: ctx.message.text,
          },
        );
      }
      eventEmitter.emit("publicationPopup", ctx.message.text, ctx);
    } catch {
      console.log(
        "error while ==> Send me your project's twitter link",
        error?.message,
      );
    }
  }

  if (ctx.message.text) {
    if (
      ctx.message.reply_to_message &&
      ctx.message.reply_to_message.text == "Send me media: Photos, Videos, Gifs"
    ) {
      // Reprompt the user to upload media
      ctx.reply("Send me media: Photos, Videos, Gifs", {
        reply_markup: {
          force_reply: true,
        },
      });
      return;
    }
  }

  if (ctx.message.photo && ctx.message.text) {
    const photo = ctx.message.photo;
    const photoId = photo[photo.length - 1].file_id;
    const file = await ctx.telegram.getFile(photoId);
    const photoUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
    const text = ctx.message.text;
    const postContent = `${text}\n${photoUrl}`;
    console.log("Post Content:", postContent);
  }
});

eventEmitter.on("solanaAddress", (description, ctx) => {
  console.log("Solana Address received:", description);
  ctx.reply("Send me your project's description. (max 520 characters)", {
    reply_markup: {
      force_reply: true,
    },
  });
});

eventEmitter.on("descriptionReceived", async (description, ctx) => {
  console.log("Description received:", description, ctx.from.id);

  ctx.reply("Send me media: Photos, Videos, Gifs", {
    reply_markup: {
      force_reply: true,
    },
  });
});

eventEmitter.on("mediaReceived", async (media, ctx) => {
  console.log("mediaReceived:", media);
  ctx.reply("Send me your project's website link", {
    reply_markup: {
      force_reply: true,
    },
  });
});

eventEmitter.on("websiteLink", (websiteLink, ctx) => {
  console.log("websiteLink:", websiteLink);
  ctx.reply("Send me your project's telegram portal portal link", {
    reply_markup: {
      force_reply: true,
    },
  });
});

eventEmitter.on("twitterLink", (twitterLink, ctx) => {
  console.log("twitterLink:", twitterLink);
  ctx.reply("Send me your project's twitter link", {
    reply_markup: {
      force_reply: true,
    },
  });
});

eventEmitter.on("publicationPopup", async (twitterLink, ctx) => {
  try {
    const advertisement = await advertisementModel.findById(
      sessions[ctx.from.id]?.advertisementId,
    );
    if (!advertisement) {
      ctx.reply("Advertisement not found, please try again by creating new!");
      return;
    }
    console.log("twitterLink:", twitterLink);
    const publications = await pricingModel.find({ isPaused: false });
    const data = [];
    publications.map((pub) => {
      data.push([
        {
          text: `${pub.publications} CALLS | ${pub.price} SOL`,
          callback_data: `publicationButton_${pub._id}`,
        },
      ]);
    });
    ctx.reply(
      "How many publications do you want? The post will be republished every 2 hours",
      {
        reply_markup: {
          inline_keyboard: [
            ...data,
            // [
            //   { text: "1 | 0.50 SOL", callback_data: "publicationBtn1" },
            //   { text: "5 | 1.80 SOL", callback_data: "publicationBtn5" },
            // ],
            // [
            //   { text: "2 | 0.90 SOL", callback_data: "publicationBtn2" },
            //   { text: "6 | 2.30 SOL", callback_data: "publicationBtn6" },
            // ],
            // [
            //   { text: "3 | 1.35 SOL", callback_data: "publicationBtn3" },
            //   { text: "7 | 2.50 SOL", callback_data: "publicationBtn7" },
            // ],
            // [
            //   { text: "4 | 1.50 SOL", callback_data: "publicationBtn4" },
            //   { text: "8 | 2.70 SOL", callback_data: "publicationBtn8" },
            // ],
          ],
        },
      },
    );
  } catch (error) {
    console.log(
      "=============publicationPopup catch block=============",
      error?.message,
    );
  }
});

bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;

  // Handle the callback data
  switch (callbackData) {
    case "publicationBtn1":
      selectedAmount = "0.50"; // Store the selected amount
      await displayExtraServices(ctx);
      break;
    case "publicationBtn2":
      await displayExtraServices(ctx);
      selectedAmount = "0.90"; // Store the selected amount
      break;
    // case "noThanks":
    //   await confirmPayment(ctx, selectedAmount);
    //   break;
    // Add cases for other buttons as needed
    default:
      break;
  }
});

async function displayExtraServices(ctx, objectId) {
  // Edit the message to display extra services prompt
  await ctx.editMessageText(
    "Do you want to add EXTRA services? \n as - pin of the post in \n the channel \n - pin of the post in the group \n - post on twitter \n - etc...",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Yes I Want Extra",
              callback_data: "extra",
            },
            { text: "No, Thanks >", callback_data: `noThanks_${objectId}` },
          ],
        ],
      },
    },
  );
}

async function confirmPayment(ctx, selectedAmount) {
  try {
    const advertisement = await advertisementModel.findById(
      sessions[ctx.from.id]?.advertisementId,
    );
    if (!advertisement) {
      ctx.reply("Advertisement not found, please try again by creating new!");
      return;
    }
    // Send the confirmation message with the dynamic amount and "Confirm" button
    const wallet = await createNewWalletToDB();

    ctx.reply(
      `Send ${selectedAmount} to the following address within 15 min:\n\n<code>${wallet.publicKey}</code>\n\nThen confirm payment.`,
      {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Confirm", callback_data: `sendObject_${wallet._id}` }],
          ],
        },
      },
    );
  } catch (error) {
    console.log(
      "=============confirmPayment catch block=============",
      error?.message,
    );
  }
}

// Start the bot
bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
// module.exports = app;
