// const sendMessageGroup = require("../main.js");
const cron = require("node-cron");
const { Telegraf } = require("telegraf");
const advertisementModel = require("../models/advertisement.model");
const ApiError = require("../utils/ApiError");
const ApiResponse = require("../utils/ApiResponse");
const asyncHandler = require("../utils/asyncHandler");
const { getTokenInfo } = require("../utils/tokenInfo");
const { bot } = require("../config/telegraf");
const { getPreSignedUrl } = require("../utils/s3.service");
const { getTokenAccounts } = require("../utils/getTokenHolders");
const moment = require("moment");
const { getChartLink } = require("../utils/getChartLink");
require("dotenv").config();
const axios = require("axios");
const userModel = require("../models/user.model");
const { postAlwaysApprove } = require("../utils/postAutoApprove");
const { where } = require("../models/wallet.model");

const getAll = asyncHandler(async (req, res, next) => {
  try {
    const { status } = req.params;

    const allAdvert = await advertisementModel.find({});

    const result = await advertisementModel
      .find({ status })
      .populate(["userId", "pricingId"]);

    const resultWithApprovedCounts = result.map((advertisement) => {
      console.log(result);
      const userId = advertisement?.userId?._id?.toString();
      const approvedCount = allAdvert.filter(
        (ad) => ad.userId.toString() === userId && ad.status === "Approved",
      ).length;

      return {
        ...advertisement.toObject(),
        approvedCount: approvedCount,
      };
    });
    return res
      .status(201)
      .json(
        new ApiResponse(200, resultWithApprovedCounts, "Advertisement list"),
      );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, `Error from server: ${error?.message}`));
  }
});

const alwaysApprove = asyncHandler(async (req, res, next) => {
  try {
    const { userId, postId, isAlwaysApproved } = req.body;
    await userModel.findByIdAndUpdate({ _id: userId }, { isAlwaysApproved });
    await postAlwaysApprove(postId);
    return res
      .status(201)
      .json(new ApiResponse(200, {}, "Advertisement always approved"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, `Error from server: ${error?.message}`));
  }
});

const getById = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await advertisementModel.findById(id);
    if (!result) {
      return res
        .status(409)
        .json(new ApiError(409, "Advertisement does not exist"));
    }

    const {
      solanaAddress,
      text,
      websiteLink,
      telegramLink,
      twitterLink,
      attachments,
      animations,
      videos,
    } = result;

    let imageLink = "";
    let animationLink = "";
    let videoLink = "";

    if (attachments && attachments.length > 0) {
      const uuid = attachments[0].uuid; // Get the UUID from the first element of the attachments array
      imageLink = await getPreSignedUrl(uuid, "wfs-pg");
      console.log("Image link:", imageLink); // Log the image link for debugging purposes
    }
    if (animations && animations.length > 0) {
      const uuid = animations[0].uuid; // Get the UUID from the first element of the animations array
      animationLink = await getPreSignedUrl(uuid, "wfs-pg");
      console.log("Animation link:", animationLink);
    }
    if (videos && videos.length > 0) {
      const uuid = videos[0].uuid; // Get the UUID from the first element of the videos array
      videoLink = await getPreSignedUrl(uuid, "wfs-pg");
      console.log("Video link:", videoLink);
    }

    return res.status(201).json(
      new ApiResponse(
        200,
        {
          ...result._doc,
          ...(imageLink && { image_link: imageLink }),
          ...(animationLink && { animation_link: animationLink }),
          ...(videoLink && { video_link: videoLink }),
        },
        "Advertisement retrieved successfully",
      ),
    );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, `Error from server: ${error?.message}`));
  }
});

const update = asyncHandler(async (req, res, next) => {
  try {
    let mediaLink = "";
    let mediaType = "";
    const { id } = req.params;
    const { status } = req.body;
    const advertisement = await advertisementModel
      .findById(id)
      .populate("pricingId")
      .populate("userId");

    if (!advertisement) {
      return res
        .status(409)
        .json(new ApiError(409, "Advertisement does not exists"));
    }
    const user = await userModel.findById(advertisement.userId);
    const {
      tokenInfo,
      holders,
      freezeAuthority,
      mintAuthority,
      poolInfo,
      transferFee,
      age,
    } = await getTokenInfo(advertisement?.solanaAddress);
    console.log("poooooooooooooooooooooools", tokenInfo);
    const { name, symbol } = tokenInfo?.baseToken;
    const { priceUsd, fdv } = tokenInfo;
    const volume = tokenInfo?.volume?.h24;
    const priceChange = tokenInfo?.priceChange?.h24;
    const liquidity = tokenInfo?.liquidity?.usd;
    const totalAccounts = await getTokenAccounts(advertisement?.solanaAddress);
    const { chartURL, buyURL } = await getChartLink(
      advertisement?.solanaAddress,
    );

    const {
      solanaAddress,
      text,
      websiteLink,
      telegramLink,
      twitterLink,
      attachments,
      animations,
      videos,
    } = advertisement;
    let image_link = "";
    let animation_link = "";
    let video_link = "";
    if (attachments && attachments.length > 0) {
      const imageLink = attachments[0].link;
      const uuid = attachments[0].uuid; // Get the link from the first element of the attachments array
      image_link = await getPreSignedUrl(uuid, "wfs-pg");
      mediaLink = image_link;
      mediaType = "sendPhoto";

      console.log("Image link:", mediaLink); // Log the image link for debugging purposes
    }
    if (animations && animations.length > 0) {
      const uuid = animations[0].uuid; // Get the link from the first element of the attachments array
      animation_link = await getPreSignedUrl(uuid, "wfs-pg");
      mediaLink = animation_link;
      mediaType = "sendAnimation";

      console.log("animation link:", animation_link); // Log the image link for debugging purposes
    }
    if (videos && videos.length > 0) {
      const uuid = videos[0].uuid; // Get the link from the first element of the attachments array
      video_link = await getPreSignedUrl(uuid, "wfs-pg");
      mediaLink = video_link;
      mediaType = "sendVideo";

      console.log("Video link:", video_link); // Log the image link for debugging purposes
    }
    advertisement.tokenName = name;
    advertisement.symbol = symbol;
    advertisement.priceUsd = priceUsd;
    advertisement.volume = Number(volume)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    });
    advertisement.tfh = volume || null;
    advertisement.holders = holders;
    advertisement.marketCapUsd = Number(fdv)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    });
    advertisement.ownerInfo = freezeAuthority;
    advertisement.mintAuthority = mintAuthority;
    advertisement.tax = transferFee;
    advertisement.chartURL = chartURL;
    advertisement.buyURL = buyURL;

    let post = `


🟢 Name: ${name}
🟢 Ticker: ${symbol}
🟢 CA: ${solanaAddress}

${text}

💵 Price: $${priceUsd}
🔀 Volume: ${Number(volume)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    })}
👤 24h: ${priceChange || null}%
⬆ Holders: ${holders}
💸 Market Cap: $${Number(fdv)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    })}

<a href="${websiteLink}">${websiteLink}</a>
<a href="${twitterLink}">${twitterLink}</a>
<a href="${telegramLink}">${telegramLink}</a>

👨‍💻 Owner: ${freezeAuthority}
🔖 Tax: ${transferFee || "No Tax Token"}
💧 LP: ${poolInfo ? "Burned 🔥" : "Not Burned ⛔️"}
💰 Liquidity: $${Number(liquidity)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    })}
🕰 Age: ${age}
👨🏻‍⚖️ Mint Authority: ${mintAuthority}

🦧 Call ID #${advertisement.postIdIncremental}
🦍 Called by ${user?.userName}

📈 <a href="${chartURL}">Chart</a> | 💳 <a href="${buyURL}">Trade Now</a>`;

    await bot.telegram[mediaType]("@ApeAvenueCalls", mediaLink, {
      caption: post,
      parse_mode: "HTML",
    })
      .then(() => console.log("Image preview sent"))
      .catch((err) => {
        console.error("Error sending image preview:", err);
      });
    const numPublications = advertisement?.pricingId?.publications;
    advertisement.totalPublications = numPublications;
    advertisement.publishedCount = 1;
    advertisement.lastPublishedTime = new Date(Date.now());
    await advertisement.save();

    await advertisementModel.findOneAndUpdate({ _id: id }, { status });

    const telegramId = advertisement.userId.telegramId;

    // Message to be sent
    let message = `
    <b>CONGRATULATIONS, YOUR CALL HAS BEEN APPROVED 🦧!</b>


🟢 Name: ${name}
🟢 Ticker: ${symbol}
🟢 CA: ${solanaAddress}

${text}

💵 Price: $${priceUsd}
🔀 Volume: ${Number(volume)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    })}
👤 24h: ${priceChange || null}%
⬆ Holders: ${holders}
💸 Market Cap: $${Number(fdv)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    })}

<a href="${websiteLink}">${websiteLink}</a>
<a href="${twitterLink}">${twitterLink}</a>
<a href="${telegramLink}">${telegramLink}</a>

👨‍💻 Owner: ${freezeAuthority}
🔖 Tax: ${transferFee || "No Tax Token"}
💧 LP: ${poolInfo ? "Burned 🔥" : "Not Burned ⛔️"}
💰 Liquidity: $${Number(liquidity)?.toLocaleString("en", {
      maximumFractionDigits: 0,
    })}
🕰 Age: ${age}
👨🏻‍⚖️ Mint Authority: ${mintAuthority}

🦧 Call ID #${advertisement.postIdIncremental}
🦍 Called by ${user?.userName}


📈 <a href="${chartURL}">Chart</a> | 💳 <a href="${buyURL}">Trade Now</a>`;

    // Sending the message
    await bot.telegram[mediaType](telegramId, mediaLink, {
      caption: message,
      parse_mode: "HTML",
    })
      .then(() => console.log("Confirmation of approval message sent to user"))
      .catch((err) => {
        console.error("Error sending message:", err);
      });

    return res
      .status(201)
      .json(
        new ApiResponse(
          200,
          advertisement,
          "Advertisement updated successfully",
        ),
      );
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json(new ApiError(500, `Error from server: ${error?.message}`));
  }
});

const deleteData = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await advertisementModel.findById(id).populate("userId");
    if (!result) {
      return res
        .status(409)
        .json(new ApiError(409, "Advertisement does not exists"));
    }
    const {
      solanaAddress,
      text,
      websiteLink,
      telegramLink,
      twitterLink,
      attachments,
      animations,
      videos,
    } = result;

    let mediaLink = "";
    let mediaType = "";
    let image_link = "";
    let animation_link = "";
    let video_link = "";
    if (attachments && attachments.length > 0) {
      const imageLink = attachments[0].link;
      const uuid = attachments[0].uuid; // Get the link from the first element of the attachments array
      image_link = await getPreSignedUrl(uuid, "wfs-pg");
      mediaLink = image_link;
      mediaType = "sendPhoto";

      console.log("Image link:", mediaLink); // Log the image link for debugging purposes
    }
    if (animations && animations.length > 0) {
      const uuid = animations[0].uuid; // Get the link from the first element of the attachments array
      animation_link = await getPreSignedUrl(uuid, "wfs-pg");
      mediaLink = animation_link;
      mediaType = "sendAnimation";

      console.log("animation link:", animation_link); // Log the image link for debugging purposes
    }
    if (videos && videos.length > 0) {
      const uuid = videos[0].uuid; // Get the link from the first element of the attachments array
      video_link = await getPreSignedUrl(uuid, "wfs-pg");
      mediaLink = video_link;
      mediaType = "sendVideo";

      console.log("Video link:", video_link); // Log the image link for debugging purposes
    }

    const telegramId = result.userId.telegramId;

    let message = `
    <b>POST REJECTED!</b>

    🟣 SOL: ${solanaAddress}

    Text: ${text}

    🦧 Call ID #${result.postIdIncremental}

    <a href="${websiteLink}">${websiteLink}</a> | <a href="${twitterLink}">${twitterLink}</a>  | <a href="${telegramLink}">${telegramLink}</a>
    `;

    if ((mediaType = "sendVideo" || "sendAnimation" || "sendPhoto")) {
      await bot.telegram[mediaType](telegramId, mediaLink, {
        caption: message,
        parse_mode: "HTML",
      })
        .then(() => console.log("Advertisement Rejection message sent to user"))
        .catch((err) => {
          console.error("Error sending message:", err);
        });

      await advertisementModel.findByIdAndDelete({ _id: id });

      return res
        .status(201)
        .json(
          new ApiResponse(200, result, "Advertisement delete successfully"),
        );
    }

    await advertisementModel.findByIdAndDelete({ _id: id });

    return res
      .status(201)
      .json(new ApiResponse(200, result, "Advertisement delete successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, `Error from server: ${error?.message}`));
  }
});

const getByIdTokenInfo = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await advertisementModel.findById(id);
    if (!result) {
      return res
        .status(409)
        .json(new ApiError(409, "Advertisement does not exist"));
    }

    const {
      tokenInfo,
      holders,
      freezeAuthority,
      mintAuthority,
      poolInfo,
      transferFee,
      age,
    } = await getTokenInfo(result?.solanaAddress);
    const { name, symbol } = tokenInfo?.baseToken;
    const { priceUsd, fdv } = tokenInfo;
    const volume = tokenInfo?.volume?.h24;
    const priceChange = tokenInfo?.priceChange?.h24;
    const liquidity = tokenInfo?.liquidity?.usd;
    const totalAccounts = await getTokenAccounts(result?.solanaAddress);
    const { chartURL, buyURL } = await getChartLink(result?.solanaAddress);

    const {
      solanaAddress,
      text,
      websiteLink,
      telegramLink,
      twitterLink,
      attachments,
      animations,
      videos,
      postIdIncremental,
    } = result;

    let imageLink = "";
    let animationLink = "";
    let videoLink = "";

    if (attachments && attachments.length > 0) {
      const uuid = attachments[0].uuid; // Get the UUID from the first element of the attachments array
      imageLink = await getPreSignedUrl(uuid, "wfs-pg");
      console.log("Image link:", imageLink); // Log the image link for debugging purposes
    }
    if (animations && animations.length > 0) {
      const uuid = animations[0].uuid; // Get the UUID from the first element of the animations array
      animationLink = await getPreSignedUrl(uuid, "wfs-pg");
      console.log("Animation link:", animationLink);
    }
    if (videos && videos.length > 0) {
      const uuid = videos[0].uuid; // Get the UUID from the first element of the videos array
      videoLink = await getPreSignedUrl(uuid, "wfs-pg");
      console.log("Video link:", videoLink);
    }
    const response = {
      freezeAuthority,
      mintAuthority,
      poolInfo,
      transferFee,
      name,
      symbol,
      solanaAddress,
      text,
      websiteLink,
      telegramLink,
      twitterLink,
      attachments,
      priceUsd,
      age,
      liquidity: Number(liquidity)?.toLocaleString("en", {
        maximumFractionDigits: 0,
      }),
      volume: Number(volume)?.toLocaleString("en", {
        maximumFractionDigits: 0,
      }),
      ["24HourChange"]: priceChange || null,
      market_cap_usd: Number(fdv)?.toLocaleString("en", {
        maximumFractionDigits: 0,
      }),
      holders,
      chartURL,
      buyURL,
      postIdIncremental,
      ...(imageLink && { image_link: imageLink }),
      ...(animationLink && { animation_link: animationLink }),
      ...(videoLink && { video_link: videoLink }),
    };

    return res
      .status(201)
      .json(
        new ApiResponse(200, response, "Advertisement retreived successfully"),
      );
  } catch (error) {
    return res
      .status(500)
      .json(new ApiError(500, `Error from server: ${error?.message}`));
  }
});

const getAdvertInfoByUser = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.params;

    const adverts = await advertisementModel
      .find({ userId: id, status: "Approved" })
      .populate("pricingId");

    const nAdsBought = adverts.length;
    const totalSpendOnAds = adverts.reduce(
      (total, ad) => total + parseFloat(ad.pricingId.price),
      0,
    );

    // Return the results
    return res.status(201).json(
      new ApiResponse(
        200,
        {
          nAdsBought: nAdsBought,
          totalSpendOnAds: totalSpendOnAds,
        },
        "Advertisement info by user ID received",
      ),
    );
  } catch (error) {
    // Handle errors
    return res
      .status(500)
      .json(new ApiError(500, `Error from server: ${error?.message}`));
  }
});

module.exports = {
  getAll,
  getById,
  update,
  deleteData,
  getByIdTokenInfo,
  alwaysApprove,
  getAdvertInfoByUser,
};
