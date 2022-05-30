const abi = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[{"internalType":"uint256","name":"tokenCount","type":"uint256"}],"name":"addTokens","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"getMyInfo","outputs":[{"internalType":"bool","name":"","type":"bool"},{"internalType":"uint256","name":"","type":"uint256"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRoundNumber","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initializePlayer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"playRound","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]
const address = "0x686964C19230d168f2dA74153a8280D64437a5b3"

// Localhost address: "0x44f571951a721BEdDB3AE62A81C26A77b21B5757"
// Replit testnet address: "0x686964C19230d168f2dA74153a8280D64437a5b3"

const gameContract = web3 => {
    return new web3.eth.Contract(abi, address)
}

export default gameContract