import { take, put, call, fork, select, takeEvery, all } from 'redux-saga/effects'
import * as actions from '../actions/transferActions'
import * as utilActions from '../actions/utilActions'
//import EXCHANGE from "../constants/exchangeFormActions"
import * as transferServices from "../services/exchange"
import constants from "../services/constants"
import * as converter from "../utils/converter"
import * as ethUtil from 'ethereumjs-util'
import Tx from "../services/tx"

function* broadCastTx(action) {
  const {ethereum, tx, account} = action.payload    
  try {            
  	const hash = yield call(ethereum.sendRawTransaction, tx, ethereum)	
    //callback(hash, tx)
    yield call(runAfterBroadcastTx, ethereum, tx, hash, account)
  	//yield put(actions.doTransactionComplete(hash, action.meta))
  }
  catch (e) {
    yield call(doTransactionFail, ethereum, account, e)
  	//yield put(actions.doTransactionFail(e, action.meta))
  }     
}


function* runAfterBroadcastTx(ethereum, txRaw, hash, account) {
  const tx = new Tx(
    hash, account.address, ethUtil.bufferToInt(txRaw.gas),
    converter.weiToGwei(ethUtil.bufferToInt(txRaw.gasPrice)),
    ethUtil.bufferToInt(txRaw.nonce), "pending", "exchange")
  tx.data = {
    sourceAmount: "a",
    destAmount: "b",
    sourceTokenSymbol:"ETH",
    destTokenSymbol:"ETH",
  }
  yield put(incManualNonceAccount(account.address))
  yield put(updateAccount(ethereum, account))
  yield put(addTx(tx))
  yield put(actions.doTransactionComplete(hash))
  yield put(actions.finishTransfer())
}

function* doTransactionFail(ethereum, account, e) {
  yield put(actions.doTransactionFail(e))
  yield put(incManualNonceAccount(account.address))
  yield put(updateAccount(ethereum, account))
}

function* approveTx(action) {
  try {
    const {ethereum, tx, callback} = action.payload   
  	const hash = yield call(ethereum.sendRawTransaction, tx, ethereum)	
  	callback(hash, tx)
  	yield put(actions.doApprovalTransactionComplete(hash, action.meta))
  }
  catch (e) {
    console.log(e)
  	yield put(actions.doApprovalTransactionFail(e, action.meta))
  }     
}


function* processTransfer(action){
  const {formId, ethereum, address,
    token, amount,
    destAddress, nonce, gas,
    gasPrice, keystring, type, password, account} = action.payload
  var call = token == constants.ETHER_ADDRESS ? transferServices.sendEtherFromAccount : transferServices.sendTokenFromAccount
  var rawTx = yield call(call, formId, ethereum, address,
    token, amount,
    destAddress, nonce, gas,
    gasPrice, keystring, type, password)
  
  if (type==="keystore"){
    const hash = yield call([ethereum,ethereum.sendRawTransaction], rawTx)	
    yield call(runAfterBroadcastTx, ethereum, rawTx, hash, account)
  }else{
    yield put(actions.showConfirm())
  }

}

export function* watchTransfer() {
  yield takeEvery("TRANSFER.TX_BROADCAST_PENDING", broadCastTx)
  yield takeEvery("TRANSFER.APPROVAL_TX_BROADCAST_PENDING", approveTx)    
  yield takeEvery("TRANSFER.PROCESS_TRANSFER", processTransfer)
}