/* eslint-disable import/extensions */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-promise-executor-return */
/* eslint-disable no-console */
const Buffer = require('buffer').Buffer;
const algosdk = require('algosdk');
const { getLocalAlgodClient, getLocalAccounts } = require('./utils');

async function main() {
  const client = getLocalAlgodClient();
  const accounts = await getLocalAccounts();
  const funder = accounts[0];
  const suggestedParams = await client.getTransactionParams().do();

  // example: LSIG_COMPILE
  const timestamp = Date.now(); // Sử dụng timestamp để tạo giá trị duy nhất
  const randomValue = Math.floor(Math.random() * 1000000); // Tạo giá trị ngẫu nhiên
  const uniqueValue = `${timestamp}${randomValue}`; // Kết hợp timestamp và giá trị ngẫu nhiên
  const smartSigSource = `#pragma version 8\nint ${uniqueValue}\nreturn`; // Thêm giá trị duy nhất vào mã nguồn
  const result = await client.compile(Buffer.from(smartSigSource)).do();

  // Hash is equivalent to the contract address
  const contractAddress = result.hash;
  console.log('Hash (Contract Address): ', contractAddress);
  console.log('B64 (Base64 Program): ', result.result);
  const b64program = result.result;
  // example: LSIG_COMPILE

  // example: LSIG_INIT
  let smartSig = new algosdk.LogicSig(
    new Uint8Array(Buffer.from(b64program, 'base64'))
  );
  // example: LSIG_INIT

  // example: LSIG_PASS_ARGS
  const args = [Buffer.from('This is an argument!')];
  smartSig = new algosdk.LogicSig(
    new Uint8Array(Buffer.from(b64program, 'base64')),
    args
  );
  // example: LSIG_PASS_ARGS

  const fundSmartSigTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: funder.addr,
    to: smartSig.address(),
    amount: 1e6,
    suggestedParams,
  });

  await client
    .sendRawTransaction(fundSmartSigTxn.signTxn(funder.privateKey))
    .do();
  await algosdk.waitForConfirmation(
    client,
    fundSmartSigTxn.txID().toString(),
    3
  );

  // example: LSIG_SIGN_FULL
  const smartSigTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: smartSig.address(),
    to: funder.addr,
    amount: 0.1e6,
    suggestedParams,
  });

  const signedSmartSigTxn = algosdk.signLogicSigTransactionObject(
    smartSigTxn,
    smartSig
  );

  await client.sendRawTransaction(signedSmartSigTxn.blob).do();
  await algosdk.waitForConfirmation(client, signedSmartSigTxn.txID, 3);
  // example: LSIG_SIGN_FULL

  // example: LSIG_DELEGATE_FULL
  const userAccount = accounts[1];

  // sign sig with userAccount so the program can send transactions from userAccount
  smartSig.sign(userAccount.privateKey);

  const delegatedTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: userAccount.addr,
    to: funder.addr,
    amount: 0.1e6,
    suggestedParams,
  });

  // use signLogicSigTransactionObject instead of the typical Transaction.signTxn function
  const signedDelegatedTxn = algosdk.signLogicSigTransactionObject(
    delegatedTxn,
    smartSig
  );

  await client.sendRawTransaction(signedDelegatedTxn.blob).do();
  await algosdk.waitForConfirmation(client, signedDelegatedTxn.txID, 3);
  // example: LSIG_DELEGATE_FULL
}
main();