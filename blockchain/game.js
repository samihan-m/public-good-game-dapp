//const abi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"uint256","name":"tokenCount","type":"uint256"}],"name":"addTokens","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getMyInfo","outputs":[{"internalType":"bool","name":"","type":"bool"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRoundNumber","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initializePlayer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"playRound","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]
//const address = "0x686964C19230d168f2dA74153a8280D64437a5b3"

// Localhost address: "0x44f571951a721BEdDB3AE62A81C26A77b21B5757"
// Replit testnet address: "0x686964C19230d168f2dA74153a8280D64437a5b3"

const abi = [{"inputs":[{"internalType":"uint256","name":"tokenCount","type":"uint256"}],"name":"addTokensToPot","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"completelyResetGame","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getCurrentRoundData","outputs":[{"components":[{"internalType":"address","name":"id","type":"address"},{"internalType":"uint256","name":"walletTokens","type":"uint256"},{"internalType":"uint256","name":"potTokens","type":"uint256"},{"internalType":"bool","name":"submitted","type":"bool"}],"internalType":"struct Game.Player[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentRoundNumber","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getMyPlayer","outputs":[{"components":[{"internalType":"address","name":"id","type":"address"},{"internalType":"uint256","name":"walletTokens","type":"uint256"},{"internalType":"uint256","name":"potTokens","type":"uint256"},{"internalType":"bool","name":"submitted","type":"bool"}],"internalType":"struct Game.Player","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getPlayerCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"roundIndex","type":"uint256"}],"name":"getRoundData","outputs":[{"components":[{"internalType":"address","name":"id","type":"address"},{"internalType":"uint256","name":"walletTokens","type":"uint256"},{"internalType":"uint256","name":"potTokens","type":"uint256"},{"internalType":"bool","name":"submitted","type":"bool"}],"internalType":"struct Game.Player[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getUnsubmittedPlayerCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initMyPlayer","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"playRound","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"resetAllPlayerFinances","outputs":[],"stateMutability":"nonpayable","type":"function"}]
const address = "0xE98EC1D621eadf9621Fe4201103e10D6B003EA54"

const gameContract = web3 => {
    return new web3.eth.Contract(abi, address)
}

export default gameContract