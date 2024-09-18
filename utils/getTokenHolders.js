require("dotenv").config();

const url = process.env.HELIUS_API_KEY;

const getTokenAccounts = async (mintAddress) => {
  let page = 1;
  let allOwners = new Set();
  let totalTokenAccounts = 0;
  let fetchingComplete = false; // Track if all token accounts are fetched

  const fetchTokenAccounts = async () => {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "getTokenAccounts",
        id: "helius-test",
        params: {
          page: page,
          limit: 1000,
          displayOptions: {},
          mint: mintAddress,
        },
      }),
    });

    const data = await response.json();

    if (!data.result || !data.result.token_accounts) {
      console.log(
        "No token accounts found in the response or result is undefined.",
      );
      fetchingComplete = true; // Set fetchingComplete to true if no token accounts are found
      return;
    }

    const tokenAccountCount = data.result.token_accounts.length;
    totalTokenAccounts += tokenAccountCount;
    data.result.token_accounts.forEach((account) =>
      allOwners.add(account.owner),
    );

    if (tokenAccountCount === 0) {
      console.log("No more token accounts to fetch.");
      fetchingComplete = true; // Set fetchingComplete to true if no more token accounts are found
    }
    page++;
  };

  // Initial API call
  await fetchTokenAccounts();

  // Set interval to call the API every second until fetching is complete
  const interval = setInterval(async () => {
    await fetchTokenAccounts();
    if (fetchingComplete) {
      clearInterval(interval); // Stop the interval once fetching is complete
      console.log("Total token accounts:", totalTokenAccounts);
    }
  }, 1000);

  // Wait for all token accounts to be fetched
  await new Promise((resolve) => {
    const checkFetchingComplete = setInterval(() => {
      if (fetchingComplete) {
        clearInterval(checkFetchingComplete);
        resolve();
      }
    }, 1000);
  });

  return totalTokenAccounts;
};

module.exports = { getTokenAccounts };
