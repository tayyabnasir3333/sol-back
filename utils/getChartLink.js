async function getChartLink(tokenId) {
  try {
    const chartURL = `https://dexscreener.com/solana/${tokenId}`;
    console.log(chartURL);
    const buyURL = `https://raydium.io/swap/?inputCurrency=sol&outputCurrency=${tokenId}&inputAmount=1&fixed=in`;
    console.log(buyURL);

    return { chartURL, buyURL };
  } catch (error) {
    console.error("Error fetching Token Info:", error.message);
    // In case of an error, return null or handle it as appropriate
    return null;
  }
}

module.exports = { getChartLink };
