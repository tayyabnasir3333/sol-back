const cron = require("node-cron");
const advertisementModel = require("../models/advertisement.model");
const { getTokenInfo } = require("../utils/tokenInfo");
const { getPreSignedUrl } = require("../utils/s3.service");
const { bot } = require("../config/telegraf");
const userModel = require("../models/user.model");
require("dotenv").config();

const publishedPostCron = async () => {
  cron.schedule("* * * * *", async () => {
    const currentTime = new Date();
    // Perform your tasks here
    console.log("Cron job started");
    try {
      const posts = await advertisementModel.find();
      posts?.map(async (post) => {
        if (
          post?.totalPublications != post?.publishedCount &&
          post?.publishedCount > 0
        ) {
          const user = await userModel.findById(post?.userId);
          const lastPublishedTime = new Date(post?.lastPublishedTime);
          const timeDifferenceMs = currentTime - lastPublishedTime;
          const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);
          if (timeDifferenceHours >= process.env.POST_PUBLISH_TIME_HOURS) {
            let mediaLink = "";
            let mediaType = "";
            let image_link = "";
            let animation_link = "";
            let video_link = "";
            if (post?.attachments && post?.attachments.length > 0) {
              const imageLink = post?.attachments[0].link;
              const uuid = post?.attachments[0].uuid; // Get the link from the first element of the attachments array
              image_link = await getPreSignedUrl(uuid, "wfs-pg");
              mediaLink = image_link;
              mediaType = "sendPhoto";

              console.log("Image link:", mediaLink); // Log the image link for debugging purposes
            }
            if (post?.animations && post?.animations.length > 0) {
              const uuid = post?.animations[0].uuid; // Get the link from the first element of the attachments array
              animation_link = await getPreSignedUrl(uuid, "wfs-pg");
              mediaLink = animation_link;
              mediaType = "sendAnimation";

              console.log("animation link:", animation_link); // Log the image link for debugging purposes
            }
            if (post?.videos && post?.videos.length > 0) {
              const uuid = post?.videos[0].uuid; // Get the link from the first element of the attachments array
              video_link = await getPreSignedUrl(uuid, "wfs-pg");
              mediaLink = video_link;
              mediaType = "sendVideo";

              console.log("Video link:", video_link); // Log the image link for debugging purposes
            }
            const tokenInfoResponse = await getTokenInfo(post?.solanaAddress);
            if (!tokenInfoResponse || !tokenInfoResponse?.tokenInfo) {
              console.log("cronjob error");
              return;
            }
            const {
              tokenInfo,
              holders,
              freezeAuthority,
              mintAuthority,
              poolInfo,
              transferFee,
              age,
            } = tokenInfoResponse;
            const priceChange = tokenInfo?.priceChange?.h24;
            const liquidity = tokenInfo?.liquidity?.usd;
            const { priceUsd, fdv } = tokenInfo;
            const volume = tokenInfo?.volume?.h24;
            let add = `


🟢 Naame: ${post?.tokenName}
🟢 Ticker: ${post?.symbol}
🟢 CA: ${post?.solanaAddress}

Text: ${post?.text}

💵 Price: $${priceUsd}
🔀 Volume: ${Number(volume)?.toLocaleString("en", {
              maximumFractionDigits: 0,
            })}
👤 24h: %${priceChange || null}
⬆ Holders: ${holders}
💸Market Cap: $${Number(fdv)?.toLocaleString("en", {
              maximumFractionDigits: 0,
            })}

<a href="${post?.websiteLink}">${post?.websiteLink}</a>
<a href="${post?.twitterLink}">${post?.twitterLink}</a>
<a href="${post?.telegramLink}">${post?.telegramLink}</a>

👨‍💻Owner: ${freezeAuthority}
🔖Tax: ${transferFee || "No Tax Token"}
💧LP: ${poolInfo ? "Burned 🔥" : "Not Burned ⛔️"}
💰Liquidity: $${Number(liquidity)?.toLocaleString("en", {
              maximumFractionDigits: 0,
            })}
  🕰Age: ${age}
 👨🏻‍⚖️Mint Authority: ${mintAuthority}

🦧 Call ID #${post?.postIdIncremental}
🦍 Called by ${user?.userName}

📈 <a href="${post?.chartURL}">Chart</a> 💳 <a href="${
              post?.buyURL
            }">Buy Now</a>`;

            await bot.telegram[mediaType]("@ApeAvenueCalls", mediaLink, {
              caption: add,
              parse_mode: "HTML",
            })
              .then(() => console.log("Image preview sent"))
              .catch((err) => {
                console.error("Error sending image preview:", err);
              });
            await advertisementModel.findByIdAndUpdate(post?._id, {
              lastPublishedTime: new Date(Date.now()),
              $inc: { publishedCount: 1 },
            });
          }
        }
      });
    } catch (error) {
      console.log("cronjob error================================");
      console.error(error);
    }
  });
  console.log("Post publishing cron");
};

module.exports = publishedPostCron;
