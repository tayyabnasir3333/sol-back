const { bot } = require("../config/telegraf");
const advertisementModel = require("../models/advertisement.model");
const userModel = require("../models/user.model");
const { getChartLink } = require("./getChartLink");
const { getTokenAccounts } = require("./getTokenHolders");
const { getPreSignedUrl } = require("./s3.service");
const { getTokenInfo } = require("./tokenInfo");

async function postAlwaysApprove(id) {
  let mediaLink = "";
  let mediaType = "";
  const status = "Approved";
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
  const { chartURL, buyURL } = await getChartLink(advertisement.solanaAddress);

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


  🟣 Name: ${name}
  🟣 Ticker: ${symbol}
  🟣 SOL: ${solanaAddress}

  Text: ${text}

  🔀 Price: $${priceUsd}
  🔀 Volume: ${Number(volume)?.toLocaleString("en", {
    maximumFractionDigits: 0,
  })}
  👤 24h: %${priceChange || null}
  ⬆ Holders: ${holders}
  💸Market Cap: $${Number(fdv)?.toLocaleString("en", {
    maximumFractionDigits: 0,
  })}

  <a href="${websiteLink}">${websiteLink}</a> | <a href="${twitterLink}">${twitterLink}</a>  | <a href="${telegramLink}">${telegramLink}</a>

  👨‍💻Owner: ${freezeAuthority}
  🔖Tax: ${transferFee || "No Tax Token"}
  💧LP: ${poolInfo ? "Burned 🔥" : "Not Burned ⛔️"}
  💰Liquidity: $${Number(liquidity)?.toLocaleString("en", {
    maximumFractionDigits: 0,
  })}
  🕰Age: ${age}
  👨🏻‍⚖️Mint Authority: ${mintAuthority}

  🦧 Call ID #${advertisement.postIdIncremental}
  🦍 Called by ${user?.userName}


  📈 <a href="${chartURL}">Chart</a> 💳 <a href="${buyURL}">Buy Now</a>`;

  await bot.telegram[mediaType]("@ApeAvenueCalls", mediaLink, {
    caption: post,
    parse_mode: "HTML",
  })
    .then(() => console.log("Image preview sent"))
    .catch((err) => {
      console.error("Error sending image preview:", err);
    });
  const numPublications = advertisement.pricingId.publications;
  advertisement.totalPublications = numPublications;
  advertisement.publishedCount = 1;
  advertisement.lastPublishedTime = new Date(Date.now());
  advertisement.status = status;
  await advertisement.save();

  await advertisementModel.findOneAndUpdate({ _id: id }, { status });

  const telegramId = advertisement.userId.telegramId;

  // Message to be sent
  let message = `
  <b>YOUR POST HAS BEEN APPROVED</b>


  🟣 Name: ${name}
  🟣 Ticker: ${symbol}
  🟣 SOL: ${solanaAddress}

  Text: ${text}

  🔀 Price: $${priceUsd}
  🔀 Volume: ${Number(volume)?.toLocaleString("en", {
    maximumFractionDigits: 0,
  })}
  👤 24h: %${priceChange || null}
  ⬆ Holders: ${holders}
  💸Market Cap: $${Number(fdv)?.toLocaleString("en", {
    maximumFractionDigits: 0,
  })}

  <a href="${websiteLink}">${websiteLink}</a> | <a href="${twitterLink}">${twitterLink}</a>  | <a href="${telegramLink}">${telegramLink}</a>

  👨‍💻Owner: ${freezeAuthority}
  🔖Tax: ${transferFee || "No Tax Token"}
  💧LP: ${poolInfo ? "Burned 🔥" : "Not Burned ⛔️"}
  💰Liquidity: $${Number(liquidity)?.toLocaleString("en", {
    maximumFractionDigits: 0,
  })}
  🕰Age: ${age}
  👨🏻‍⚖️Mint Authority: ${mintAuthority}

  🦧 Call ID #${advertisement.postIdIncremental}
  🦍 Called by ${user?.userName}

  📈 <a href="${chartURL}">Chart</a> 💳 <a href="${buyURL}">Buy Now</a> `;

  // Sending the message
  await bot.telegram[mediaType](telegramId, mediaLink, {
    caption: message,
    parse_mode: "HTML",
  })
    .then(() => console.log("Confirmation of approval message sent to user"))
    .catch((err) => {
      console.error("Error sending message:", err);
    });
}

module.exports = { postAlwaysApprove };
