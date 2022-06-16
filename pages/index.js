import Head from 'next/head'
import { useState, useEffect } from 'react'
import Web3 from 'web3'
import gameContract from '../blockchain/game'
import 'bulma/css/bulma.css'
import styles from '../styles/Game.module.css'

/*
Real TODO:
What information does this page need?

1. Your token count
  -Load on startup, then update every time round progresses
2. Your token in pot count
  -Update on submit-button-click, reset every time round progresses
3. Round number
  -Update every time round progresses
4. Is this needed? - Number of players you're playing with
  -Auto-update via check loop
5. What your gain was from last round
  -Update every time round progresses
6. What each other player put in last round
  -Update every time round progresses
7. What each other player put in the last last round
  -Update every time round progresses

1. Connect wallet
  -Disabled on connect, starts info fetch loop
2. Request tokens (INITIALIZE PLAYER)
  -Hidden until connected, hidden if initialized already -> hidden upon initialization
  -Loading until contract says player is initialized
3. Number input for tokens
  -Hidden until connected + initialized -> visible forever
4. Submit tokens
  -Hidden until connected + initialized -> enabled until valid submission -> disabled until round progression
  -Loading until contract says player is submitted


FSM
Disabled -> Enabled -> Loading
D, Initialized -> E
E, Bad Click -> E
E, Good Click -> L
L, Confirm -> D
*/

const Game = () => {

  const switchToReplitTestnet = async () => {
    window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
          {
              chainId: "0x7265706c",
              chainName: "Replit Testnet",
              rpcUrls: ["https://eth.replit.com"],
              iconUrls: [
                  "https://upload.wikimedia.org/wikipedia/commons/b/b2/Repl.it_logo.svg",
              ],
              nativeCurrency: {
                  name: "Replit ETH",
                  symbol: "RΞ",
                  decimals: 18,
              },
          },
      ],
    });
  }

  const buttonStates = {
    DISABLED: 0,
    ENABLED: 1,
    LOADING: 2,
  };

  const [tokens, setTokens] = useState(0);
  const [potTokens, setPotTokens] = useState(0);
  const [tokensToGive, setTokensToGive] = useState(0);
  const [roundNumber, setRoundNumber] = useState(-1);
  /*
  Array of Arrays where each subarray has 4 elements
  (All the values are in strings so convert them when needed)
  0. Player id (address)
  1. Tokens in wallet (int)
  2. Tokens in pot (int)
  3. Has the player submitted (bool)
  */
  const [roundInfo, setRoundInfo] = useState([]);
  const [lastRoundInfo, setLastRoundInfo] = useState([]);
  // use web3 to determine if wallet is connected
  const [initializerState, setInitializerState] = useState(buttonStates.DISABLED);
  const [submitterState, setSubmitterState] = useState(buttonStates.DISABLED);

  const [log, setLog] = useState("Useful information will appear here.");
  const [web3, setWeb3] = useState(null);
  const [address, setAddress] = useState(null);
  const [contract, setContract] = useState(null);
  
  // For disabling contract read loop
  const [isGameRunning, setIsGameRunning] = useState(true);

  // Used for sleeping during ping loops
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // Update state variable with user input on change
  const updateTokensToGive = event => {
    setTokensToGive(event.target.value)
  }

  // Load all possible information from the contract
  const readGameState = async() => {
    let enterWaitLoop = false;
    try {
      await contract.methods.getMyPlayer().call({from: address}, async function(error, result) {
        if(error) console.log(error);
        // console.log("Player: " + result);
        if(/^0x0+$/.test(result.id)) {
          // Player doesn't exist yet
          setInitializerState(buttonStates.ENABLED);
          setSubmitterState(buttonStates.DISABLED);
          setLog("Request tokens to play.")
        }
        else {
          // Player exists, display player-specific data
          setInitializerState(buttonStates.DISABLED);
          setTokens(result.walletTokens);
          setPotTokens(result.potTokens);
          if(result.submitted == true) {
            setSubmitterState(buttonStates.DISABLED);
            enterWaitLoop = true;
          }
          else {
            setSubmitterState(buttonStates.ENABLED);
          }
          // setSubmitterState(result.submitted ? buttonStates.DISABLED : buttonStates.ENABLED);
        }
      })
      await contract.methods.getCurrentRoundNumber().call({from: address}, async function(error, roundNumber) {
        roundNumber = parseInt(roundNumber);
        if(error) console.log(error);
        // console.log(result);
        let roundIndex = roundNumber - 1;
        setRoundNumber(roundNumber);
        if(roundIndex <= 0) {
          console.log("No previous round exists.");
          return;
        }
        await contract.methods.getRoundData(roundIndex - 1).call({from: address}, async function(error, result) {
          if(error) console.log(error);
          // console.log(result);
          setRoundInfo(result);
          updateLastRoundInfo(result);
        })
        if(roundIndex <= 1) {
          // console.log("No previous previous round exists.")
          return;
        }
        await contract.methods.getRoundData(roundIndex - 2).call({from: address}, async function(error, result) {
          if(error) console.log(error);
          // console.log(result);
          setLastRoundInfo(result);
          updateLastLastRoundInfo(result);
        })
      })
      if(enterWaitLoop == true) {
        waitForNewRound();
      }
    } catch(err) {
      if(error) console.log(err)
      alert("Error fetching game information. Check console log.")
    }
  }

  const calculateRoundRevenue = (playerList) => {
    let potTotal = 0;
    for(let player of playerList) {
      potTotal += parseInt(player[2]);
    }
    // Formula in contract: 
    // uint revenuePerCapita = (potTotal * 14)/10/playerCount;
    let revenue = (potTotal * 1.4)/playerList.length;
    return Math.floor(revenue);
  }
  
  const getDataReport = (playerList) => {
    let lastRoundReport = "";
    let revenue = calculateRoundRevenue(playerList);
    let index = 1;
    let tokensGivenLastRound = -1;
    let potTotal = 0;
    for(let player of playerList) {
      potTotal += parseInt(player[2]);
      if(player[0] == address.toString()) {
        tokensGivenLastRound = player[2];
      }
      let playerReport = `Last round player ${index} put ${player[2]} tokens into the pot.`;
      index += 1;
      lastRoundReport += `\n${playerReport}`;
    }
    if(tokensGivenLastRound == -1) {
      // The player did not exist last round.
      // Show that this player did not get any money for playing (because they did not play LOL)
      tokensGivenLastRound = 0;
      revenue = 0;
    }
    lastRoundReport += `\nYou gave ${tokensGivenLastRound} tokens last round and earned ${revenue}, for a profit of ${revenue - tokensGivenLastRound}.`;
    lastRoundReport += `\nThe pot size last round was ${potTotal} tokens.`;
    return lastRoundReport;
  }

  const updateLastRoundInfo = (playerList) => {
    let dataReport = getDataReport(playerList);
    const dataDisplay = document.getElementById("lastRoundInfo");
    dataDisplay.innerText = dataReport;
  }

  const updateLastLastRoundInfo = (playerList) => {
    let dataReport = getDataReport(playerList);
    const dataDisplay = document.getElementById("lastLastRoundInfo");
    dataDisplay.innerText = dataReport;
  }

  useEffect(() => {
    if(contract && address) {
      // Load game data
      readGameState();
    }
  }, [contract, address])

  const connectWalletHandler = async() => {
    // Check if Metamask is installed
    if(typeof window == "undefined" || typeof window.ethereum == "undefined") {
      alert("Please install Metamask!")
      return;
    }

    try {
      // Request wallet connection
      await window.ethereum.request({ method: "eth_requestAccounts" })

      // Set web3 instance
      web3 = new Web3(window.ethereum)
      setWeb3(web3)

      // Get user to switch to the proper network
      switchToReplitTestnet()

      // Get list of accounts
      const accounts = await web3.eth.getAccounts()
      const account = accounts[0]
      setAddress(account)

      // Create local contract copy
      const contract = gameContract(web3)
      setContract(contract)

      setLog("Wallet connected successfully.")
      
    } catch(err) {
      console.log(err.message)
      alert("Something broke. Check console logs.")
    } 
    
  }

  const initializePlayerHandler = async() => {
    // Disable initialize button so users do not do it multiple times
    setInitializerState(buttonStates.LOADING);
    
    setLog("Requesting tokens, please wait...");

    try {
      // Initialize player
      await contract.methods.initMyPlayer().send({
          from: address,
        }, async function(error, hash) {
          const interval = setInterval(function() {
            web3.eth.getTransactionReceipt(hash, function(err, rec) {
              if (rec) {
                // Update information
                setInitializerState(buttonStates.DISABLED);
                readGameState();
                // Open access to game
                setSubmitterState(buttonStates.ENABLED);
                setLog("You can now play!")
                clearInterval(interval);
              }
            });
          }, 1000);
        }
      )
    }
    catch (err) {
      alert("Failed to request tokens for new player! Check console for more detail.");
      console.log(err);
    }
  }

  // Read game state on loop until the round changes then do something
  const waitForNewRound = async() => {
    setLog("Waiting for this round to be completed...")
    let doKeepWaiting = true;
    let currentRoundNumber;
    try {
      await contract.methods.getCurrentRoundNumber().call({
        from: address
      }, async function(error, _roundNumber) {
          if(error) console.log(error);
          setRoundNumber(parseInt(_roundNumber));
          currentRoundNumber = parseInt(_roundNumber);
      })
    } catch(err) {
      
    }
    while(doKeepWaiting) {
      try {
        await sleep(1000);
        await contract.methods.getMyPlayer().call({
            from: address
          }, async function(error, player) {
            if(error) console.log(error);
            if(player.submitted == false) {
              doKeepWaiting = false;
            }
          }
        )
      } catch(err) {
        alert("Something broke while waiting for the round to pass! Check console for more details.");
        console.log(err);
      }
    }
    readGameState();
    setLog(`Round ${currentRoundNumber} complete!\nNow playing round ${currentRoundNumber + 1}.`);
    setRoundNumber(currentRoundNumber + 1);
  }

  // Submit tokens to chain
  const submitHandler = async() => {
    // Validate input
    if(tokensToGive != parseInt(tokensToGive)) {
      setLog("The provided value must be a number.");
      return;
    }
    if(parseInt(tokensToGive) > parseInt(tokenTotal)) {
      setLog("You can't put in more tokens than you own.");
      return;
    }
    // Can uncomment this if it's useful
    setLog("Submitting...");
    setSubmitterState(buttonStates.LOADING);

    // Post to chain
    try {
      await contract.methods.addTokensToPot(tokensToGive).send({
          from: address,
        }, async function(error, hash) {
          const interval = setInterval(function() {
          web3.eth.getTransactionReceipt(hash, async function(err, rec) {
            if (rec) {
              setSubmitterState(buttonStates.DISABLED);
              clearInterval(interval);
              document.getElementById("tokensToGive").value = 0;
              setTokensToGive(0);
              readGameState();
            }
          });
        }, 1000);
        }
      )
    } catch(err) {
      alert("Adding tokens to pot failed! Check console for more details.");
      console.log(err);
    }
  }

  return (
    <div className={styles.main}>
      <Head>
        <title>Public Good Game on the Blockchain</title>
        <meta name="description" content="A public good game on the blockchain"/>
      </Head>
      <nav className="navbar mt-4 mb-4">
        <div className="container">
          <div className="navbar-brand">
            <h1>Public Good Game</h1>
          </div>
        </div>
      </nav>
      <section id="game" className="columns">
        <div className="has-text-centered column is-one-third">
          <div className="is-size-4" style={{display: (roundInfo.length <= 0) ? 'none' : ''}}>
            Previous Round Reports
          </div>
          <div id="lastRoundReport" style={{display: (roundInfo.length <= 0) ? 'none' : ''}}>
            <p className="is-size-5">Last Round:</p>
            <p id="lastRoundInfo"></p>
          </div>
          <br></br>
          <div id="lastLastRound" style={{display: (lastRoundInfo.length <= 1) ? 'none' : ''}}>
            <p className="is-size-5">Last Last Round:</p>
            <p id="lastLastRoundInfo"></p>
          </div>
        </div>
        <div className="has-text-centered column is-one-third is-size-4">
          <div id="roundNumber" className="" style={{display: (web3 === null) ? 'none' : ''}}>
            Round {roundNumber}
          </div>
          <br></br>
          <div id="playerInfo" className="container" style={{display: (web3 === null) ? 'none' : ''}}>
            <p id="tokenTotal">You have {tokens} tokens.</p>
            <p id="inPotTokenTotal">You currently have {potTokens} tokens in the pot.</p>
          </div>
          <br></br>
          <div id="input" style={{display: (submitterState == buttonStates.DISABLED) ? 'none' : ''}}>
            <span>How many tokens do you want to put into the pot?</span>
            <input id="tokensToGive" onChange={updateTokensToGive} className="input is-info mt-4 mb-4" type="number" placeholder="0" />
            <button id="submitButton" onClick={submitHandler} className={(submitterState != buttonStates.ENABLED) ? "button is-primary mb-2 is-loading" : "button is-primary mb-2"} disabled={(submitterState != buttonStates.ENABLED) ? true : false}>Submit</button>
          </div>
          <div className="mt-6 mb-6">
            <button id="connectWalletButton" onClick={connectWalletHandler} className="button is-primary mb-2" style={{display: (web3 === null) ? '' : 'none'}} disabled={web3 === null ? false : true}>Join Game</button>
            <br />
            <button id="initializeButton" onClick={initializePlayerHandler} className={(initializerState == buttonStates.LOADING) ? "button is-primary mb-2 is-loading" : "button is-primary mb-2"} disabled={(initializerState != buttonStates.ENABLED) ? true : false} style={{display: (initializerState == buttonStates.DISABLED) ? 'none' : ''}}>Request Tokens</button>
          </div>
          <div className="container has-text-success is-size-4" style={{display: (web3 === null) ? 'none' : ''}}>
            <p>{log}</p>
          </div>
        </div>
        <div className="column is-one-third"></div>
      </section>
      <section>
        <div className="container" style={{display: 'none'}}>
          <p>Text goes here</p>
        </div>
      </section>
    </div>
  )
  
}

export default Game