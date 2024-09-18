const { default: axios } = require("axios");
const { Connection, clusterApiUrl, PublicKey } = require("@solana/web3.js");
const {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  TOKEN_PROGRAM_ID,
  TokenInvalidAccountOwnerError,
} = require("@solana/spl-token");
const { getTokenAccounts } = require("./getTokenHolders");
require("dotenv").config();

const connection = new Connection(process.env.HELIUS_API_KEY, "finalized");

async function getOwnerInfo(NFTAddress) {
  try {
    const mintAddress = new PublicKey(NFTAddress);

    const ownerInfo = await getMint(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );

    if (ownerInfo?.freezeAuthority == null) {
      return "Renounced";
    } else {
      return "Non-Renounced";
    }
  } catch (error) {
    const mintAddress = new PublicKey(NFTAddress);

    // Retry with a different program ID if TokenInvalidAccountOwnerError occurs

    if (error instanceof TokenInvalidAccountOwnerError) {
      // console.log("Retrying with TOKEN_2022_PROGRAM_ID...");

      const ownerInfo = await getMint(
        connection,
        mintAddress,
        "confirmed",
        TOKEN_2022_PROGRAM_ID,
      );

      if (ownerInfo?.freezeAuthority == null) {
        return "Renounced";
      } else {
        return "Non-Renounced";
      }
    }

    if (error?.name === "TokenAccountNotFoundError") {
      throw new Error("Invalid public key input");
    }

    return "Error";
  }
}
async function getOwnerInfoFreezeAuthority(NFTAddress) {
  try {
    console.log("Freeze Authority Info");
    const mintAddress = new PublicKey(NFTAddress);
    const ownerInfo = await getMint(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
    console.log("freezeAuthority", ownerInfo?.freezeAuthority);
    if (ownerInfo?.freezeAuthority == null) {
      return "Renounced";
    } else {
      return "Non-Renounced";
    }
  } catch (error) {
    const mintAddress = new PublicKey(NFTAddress);
    if (error instanceof TokenInvalidAccountOwnerError) {
      console.log("Retrying with TOKEN_2022_PROGRAM_ID...");
      const ownerInfo = await getMint(
        connection,
        mintAddress,
        "confirmed",
        TOKEN_2022_PROGRAM_ID,
      );
      if (!ownerInfo) {
        throw new Error("Unable to find existing nft or image uri!");
      }
      if (ownerInfo?.freezeAuthority == null) {
        return "Renounced";
      } else {
        return "Non-Renounced";
      }
    } else if (error?.name == "TokenAccountNotFoundError") {
      throw new Error("Address is Incorrect!");
    }
    return error;
  }
}

async function getOwnerInfoMintAuthority(NFTAddress) {
  try {
    console.log("Mint Authority Info");
    const mintAddress = new PublicKey(NFTAddress);
    const ownerInfo = await getMint(
      connection,
      mintAddress,
      "confirmed",
      TOKEN_PROGRAM_ID,
    );
    console.log("mint Authority", ownerInfo?.mintAuthority);
    if (ownerInfo?.mintAuthority == null) {
      return "Renounced";
    } else {
      return "Non-Renounced";
    }
  } catch (error) {
    const mintAddress = new PublicKey(NFTAddress);
    if (error instanceof TokenInvalidAccountOwnerError) {
      console.log("Retrying with TOKEN_2022_PROGRAM_ID...");
      const ownerInfo = await getMint(
        connection,
        mintAddress,
        "confirmed",
        TOKEN_2022_PROGRAM_ID,
      );
      if (!ownerInfo) {
        throw new Error("Unable to find existing nft or image uri!");
      }
      if (ownerInfo?.mintAuthority == null) {
        return "Renounced";
      } else {
        return "Non-Renounced";
      }
    } else if (error?.name == "TokenAccountNotFoundError") {
      throw new Error("Address is Incorrect!");
    }
    return error;
  }
}

const url = process.env.HELIUS_GET_ASSETS;

async function getAsset(tokenAddress) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "my-id",
        method: "getAsset",
        params: {
          id: tokenAddress,
        },
      }),
    });

    const { result } = await response.json();
    // console.log("result", result);
    const transferFeeBasisPoints =
      result?.mint_extensions?.transfer_fee_config?.newer_transfer_fee
        ?.transfer_fee_basis_points;
    const transferFee = transferFeeBasisPoints / 100;
    return transferFee;
  } catch (error) {
    console.error("Error fetching transfer fee:", error);
    throw error; // Throw the error to handle it outside
  }
}

async function getPoolInfo(poolId) {
  const url = `https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolId}`;
  try {
    const response = await axios.get(url);
    const pool = response.data.data;
    const poolInfo = await GetLPBurnInfo(pool.attributes.address);
    console.log("poolInfo: ", poolInfo);
    return { pool, poolInfo };
  } catch (error) {
    console.error("Error fetching Pool Info:", error.message);
  }
}

async function getTokenInfo(tokenId) {
  const url = `${process.env.TOKEN_INFO_DEX_SCANNER_API}/${tokenId}`;
  try {
    // const holders = await getTokenAccounts(tokenId);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    if (data?.pairs == null) {
      console.error("Token data not found");
      return;
    }
    const tokenData = data?.pairs[0];
    const transferFee = await getAsset(tokenId);
    const freezeAuthority = await getOwnerInfoFreezeAuthority(tokenId);
    const mintAuthority = await getOwnerInfoMintAuthority(tokenId);
    const poolInfo = await GetLPBurnInfo(tokenData?.pairAddress);
    const holders = await getTokenAccounts(tokenId);

    console.log("--------------------------------------");
    console.log("Name: ", tokenData?.baseToken?.name);
    console.log("Ticker: ", tokenData?.baseToken?.symbol);
    console.log("SOL: ", tokenId);
    console.log("Price: ", tokenData?.priceUsd);
    console.log("Volume: ", tokenData?.volume?.h24);
    console.log("24h: ", tokenData?.priceChange?.h24);
    console.log("Holders: ", holders);
    console.log("Market Cap: ", tokenData?.fdv);
    console.log("Freeze Authority: ", freezeAuthority);
    console.log("Mint Authority: ", mintAuthority);
    console.log("LP Burned:", poolInfo);
    console.log("Token Liquidity: ", tokenData?.liquidity?.usd);
    console.log("Transfer Tax: ", transferFee);
    const date = new Date(tokenData?.pairCreatedAt);
    const currentTime = new Date();
    const durationInSeconds = Math.floor((currentTime - date) / 1000);
    const days = Math.floor(durationInSeconds / (24 * 60 * 60));
    const hours = Math.floor((durationInSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((durationInSeconds % (60 * 60)) / 60);
    const seconds = durationInSeconds % 60;
    const age = `${days}d, ${hours}h, ${minutes}m, ${seconds}s`;

    console.log(age);
    return {
      tokenInfo: tokenData,
      holders,
      freezeAuthority,
      mintAuthority,
      poolInfo,
      transferFee,
      age,
    };
  } catch (error) {
    console.error("Error fetching Token Info:", error.message);
  }
}

const getTransactions = async (address, numTx) => {
  try {
    const pubKey = new PublicKey(address);

    let transactionList = await connection.getSignaturesForAddress(pubKey, {
      limit: numTx,
    });
    if (transactionList.length === 0) {
      return "No transactions found for the provided address.";
    }

    let signatureList = transactionList.map(
      (transaction) => transaction.signature,
    );

    let transactionDetails = await connection.getParsedTransactions(
      signatureList,
      { maxSupportedTransactionVersion: 0 },
    );

    let instructionsList = transactionDetails.map(
      (tx) => tx.transaction.message.instructions,
    );

    let parsedList = instructionsList.map((instructions) =>
      instructions.map((instruction) => instruction.parsed),
    );

    let isBurnChecked = parsedList.some((parsed) =>
      parsed.some(
        (instruction) =>
          instruction &&
          (instruction.type === "burn" || instruction.type === "burnChecked"),
      ),
    );
    // return isBurnChecked ? "Token Burned" : "Not Burned";
    return isBurnChecked;
  } catch (error) {
    console.log(error);
    return "Error";
  }
};

// Function to decode the buffer data
function decodePoolState(data) {
  return {
    // baseMint: new PublicKey(data.slice(368, 400)),
    // quoteMint: new PublicKey(data.slice(400, 432)),
    lpMint: new PublicKey(data.slice(464, 496)),
    // lpMint: new PublicKey(data.slice(432, 464)), // Corrected offset
  };
}

const GetLPBurnInfo = async (Pool_Address) => {
  try {
    const info = await connection.getAccountInfo(new PublicKey(Pool_Address));
    if (info?.data) {
      const poolState = decodePoolState(info?.data);
      const LPinfo = await getTransactions(poolState.lpMint.toString(), null); // Pass string representation of lpMint
      return LPinfo;
    }
  } catch (error) {
    console.error("Error:", error);
  }
};

function isValidSolanaAddress(address) {
  // Regular expression to match Solana wallet addresses
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return solanaAddressRegex.test(address);
}

module.exports = { getTokenInfo, getOwnerInfo, isValidSolanaAddress };
