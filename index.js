import { Connection, Keypair } from "@solana/web3.js";
import { getOrca, OrcaPoolConfig } from "@orca-so/sdk";
import Decimal from "decimal.js";
import bs58 from "bs58";

const secretKey = process.env.SECRETKEY
const decoded = bs58.decode(secretKey);
const owner = Keypair.fromSecretKey(decoded);
const connection = new Connection("https://api.mainnet-beta.solana.com", "singleGossip");
const orca = getOrca(connection);

// The general swap function
const swap = async (recieveTokenB = false, giveTokenIsSOL = false, pool, orca, connection) => {

  try {
    /*** Swap ***/
    var giveToken;
    var recieveToken;
    if(recieveTokenB) {
      giveToken = pool.getTokenA();
      recieveToken = pool.getTokenB();
    } else {
      giveToken = pool.getTokenB();
      recieveToken = pool.getTokenA();
    }

    var giveAmount;
    if(giveTokenIsSOL) {
      const solLamportAmount = await connection.getBalance(owner.publicKey)
      const solBalance = await solLamportAmount * 0.000000001
      const maxSolTradeAmount = await solBalance - 0.10
      giveAmount = new Decimal(maxSolTradeAmount);
    } else {
      const tokenInfo = await connection.getParsedTokenAccountsByOwner(owner.publicKey, {mint: giveToken.mint}, {encoding: "jsonParsed"})
      const tokenAmount = await tokenInfo.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      giveAmount = new Decimal(tokenAmount);
    }
    const quote = await pool.getQuote(giveToken, giveAmount);
    const recieveAmount = quote.getMinOutputAmount();

    console.log(`Swap ${giveAmount.toString()} ${giveToken.name} for at least ${recieveAmount.toNumber()} ${recieveToken.name}`);
    const swapPayload = await pool.swap(owner, giveToken, giveAmount, recieveAmount);
    const swapTxId = await swapPayload.execute();
    console.log("Swapped:", swapTxId, "\n");
    return swapTxId;
  } catch (err) {
    console.warn(err);
  }
};

const trade = async (action, orca, connection) => {

  try {

  if (action == "buy") {
    const middlePool = await orca.getPool(OrcaPoolConfig.SOL_USDC);
    const pool = await orca.getPool(OrcaPoolConfig.STEP_SOL);
    const giveToken = pool.getTokenA();
    const recieveToken = pool.getTokenB();
    const tokenInfo = await connection.getParsedTokenAccountsByOwner(owner.publicKey, {mint: giveToken.mint}, {encoding: "jsonParsed"})
    const tokenAmount = await tokenInfo.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    if(tokenAmount < 1) {
      // Middleman swap action to convert USDC to SOL
      await swap(false, false, middlePool, orca, connection)
      // Main swap action to convert SOL to STEP
      const swapTxId = await swap(false, true, pool, orca, connection)
      return swapTxId;
    } else {
      console.log(giveToken.name + " is already owned.")
    }
  } else if (action == "sell") {
    const middlePool = await orca.getPool(OrcaPoolConfig.STEP_SOL);
    const pool = await orca.getPool(OrcaPoolConfig.SOL_USDC);
    const giveToken = pool.getTokenA();
    const recieveToken = pool.getTokenB();
    const tokenInfo = await connection.getParsedTokenAccountsByOwner(owner.publicKey, {mint: recieveToken.mint}, {encoding: "jsonParsed"})
    const tokenAmount = await tokenInfo.value[0].account.data.parsed.info.tokenAmount.uiAmount;
    if(tokenAmount < 1) {
      // Middleman swap action to convert USDC to SOL
      await swap(true, false, middlePool, orca, connection)
      // Main swap action to convert SOL to STEP
      const swapTxId = await swap(true, true, pool, orca, connection)
      return swapTxId;
    } else {
      console.log(recieveToken.name + " is already owned.")
    }
  } else {
     console.log("The action " + action + " does not exist.")
  }

  // Log that we are done
  console.log("Done")
  } catch (err) {
    console.log(err)
  }

}

trade(process.argv[2], orca, connection)