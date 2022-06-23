import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Web3 from 'web3'
import gameContract from '../blockchain/game'
import 'bulma/css/bulma.css'
import styles from '../styles/Game.module.css'
import Navbar from '../components/navbar.js'

/*
Most real TODO:

Remember that when playing on new computers, we will need to give all of them ETH.

*/

/*
Page Outline:
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

  /*
  Finite State Machine for Buttons
  States: Disabled, Enabled, Loading
  D, Initialized -> E
  E, Bad Click -> E
  E, Good Click -> L
  L, Confirm -> D
  */
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
  roundInfo: 
  Array of Arrays where each subarray has 4 elements
  (All the values are in strings so convert them when needed)
  0. Player id (address)
  1. Tokens in wallet (int)
  2. Tokens in pot (int)
  3. Has the player submitted (bool)
  */
  const [roundInfo, setRoundInfo] = useState([]);
  const [lastRoundInfo, setLastRoundInfo] = useState([]);
  const [profitFactor, setProfitFactor] = useState(1.4);
  const [minPotTotal, setMinPotTotal] = useState(20);
  
  const [connectorState, setConnectorState] = useState(buttonStates.DISABLED);
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

  // Used for restarting pages
  const router = useRouter()

  // Update state variable with user input on change
  const updateTokensToGive = event => {
    setTokensToGive(event.target.value)
  }

  // Load all possible information from the contract
  const readGameState = async() => {
    let enterWaitLoop = false;
    try {
      await contract.methods.getProfitFactor().call({from: address}, async function(error, result) {
        if(error) {
          alert("Something broke while trying to read the game's profit factor. Check console for details.");
          console.log(error);
        }
        setProfitFactor(parseFloat(result)/10);
      })
      await contract.methods.getValidPotMinimum().call({from: address}, async function(error, result) {
        if(error) {
          alert("Something broke while trying to read the game's valid pot minimum. Check console for details.");
          console.log(error);
        }
        setMinPotTotal(result);
      })
      await contract.methods.getMyPlayer().call({from: address}, async function(error, result) {
        if(error) {
          alert("Something broke while trying read your player data. Check console for details.")
          console.log(error);
        }
        // Check if the returned address is the empty address
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
          // If the player has already submitted, start waiting for the round to end
          if(result.submitted == true) {
            setSubmitterState(buttonStates.DISABLED);
            enterWaitLoop = true;
          }
          else {
            setSubmitterState(buttonStates.ENABLED);
          }
        }
      })
      await contract.methods.getCurrentRoundNumber().call({from: address}, async function(error, roundNumber) {
        roundNumber = parseInt(roundNumber);
        if(error) {
          console.log(error);
        }
        // console.log(result);
        let roundIndex = roundNumber - 1;
        setRoundNumber(roundNumber);
        // Ensure there are previous rounds to read from
        if(roundIndex <= 0) {
          // console.log("No previous round exists.");
          return;
        }
        await contract.methods.getRoundData(roundIndex - 1).call({from: address}, async function(error, result) {
          if(error) console.log(error);
          // console.log(result);
          setRoundInfo(result);
          updateLastRoundInfo(result);
          updateLastRoundTable(result);
        })
        // Ensure there is another previous round to read from
        if(roundIndex <= 1) {
          // console.log("No previous previous round exists.")
          return;
        }
        await contract.methods.getRoundData(roundIndex - 2).call({from: address}, async function(error, result) {
          if(error) console.log(error);
          // console.log(result);
          setLastRoundInfo(result);
          updateLastLastRoundInfo(result);
          updateLastLastRoundTable(result);
        })
      })
      if(enterWaitLoop == true) {
        waitForNewRound();
      }
    } catch(err) {
      console.log(err)
      alert("Error fetching game information. Check console log.")
    }
  }

  const calculateRoundRevenue = (playerList) => {
    let potTotal = 0;
    for(let player of playerList) {
      potTotal += parseInt(player.potTokens);
    }
    // Formula in contract: 
    let revenue = (potTotal * profitFactor)/playerList.length;
    return Math.floor(revenue);
  }

  const getStrippedCSVData = (playerList) => {
    let csvData = "";
    csvData = "Player, Tokens in Pot Last Round";
    let potTotal = 0;
    for(let player of playerList) {
      csvData += `\n${player.id}, ${player.potTokens}`;
      potTotal += parseInt(player.potTokens);
    }
    csvData += `\nTotal, ${potTotal}`
    return csvData;
  }
  
  const getDataReport = (playerList) => {
    let lastRoundReport = "";
    let revenue = calculateRoundRevenue(playerList);
    let tokensGivenLastRound = -1;
    let potTotal = 0;
    for(let player of playerList) {
      potTotal += parseInt(player[2]);
      if(player[0] == address.toString()) {
        tokensGivenLastRound = player[2];
      }
    }
    if(potTotal < minPotTotal) {
      lastRoundReport += "Contract Rejected ❌";
      lastRoundReport += "\nTotal pot contributions were too small.";
      lastRoundReport += `\n(Must be at least ${minPotTotal} tokens).`;
    }
    else {
      lastRoundReport += "Contract Accepted ✅"
      if(tokensGivenLastRound == -1) {
        lastRoundReport += `\nYou did not play this round, so you earned nothing.`;
      }
      else {
        lastRoundReport += `\nYou earned ${revenue} tokens, for a profit of ${revenue - tokensGivenLastRound} tokens.`;
      }
    }
    return lastRoundReport;
  }

  const updateLastRoundTable = (playerData) => {
    const dataTable = document.getElementById("lastRoundTable");
    updateRoundTable(playerData, dataTable);
  }

  const updateLastLastRoundTable = (playerData) => {
    const dataTable = document.getElementById("lastLastRoundTable");
    updateRoundTable(playerData, dataTable);
  }

  const updateRoundTable = (playerData, tableElement) => {
    let csvData = getStrippedCSVData(playerData);
    const dataTable = tableElement;
    while(dataTable.rows.length > 0) {
      dataTable.deleteRow(0);
    }
    let csvRows = csvData.split("\n");
    let cells = [];
    for(let row of csvRows) {
      cells += row.split(",");
    }
    let playerCounter = 1;
    for(let row of csvRows) {
      let tableRow = dataTable.insertRow(dataTable.rows.length);
      for(let cell of row.split(",")) {
        let tableCell = tableRow.insertCell(tableRow.cells.length);
        if(cell.includes("0x")) {
          if(cell.toString() == address.toString()) {
            cell = "You"
          }
          else {
            cell = `P${playerCounter}`;
          }
          playerCounter++;
        }
        tableCell.innerText = cell;
      }
    }
  }

  const updateRoundInfo = (playerList, htmlElement) => {
    let dataReport = getDataReport(playerList);
    htmlElement.innerText = dataReport;
    if(dataReport.includes("Rejected")) {
      htmlElement.className = "has-background-danger has-text-white";
    }
    else if(dataReport.includes("Accepted")) {
      htmlElement.className = "has-background-success has-text-white";
    }
    else {
      htmlElement.className = "has-text-black";
    }
    htmlElement.className += " is-size-5 mx-6"
  }

  const updateLastRoundInfo = (playerList) => {
    const dataDisplay = document.getElementById("lastRoundInfo");
    updateRoundInfo(playerList, dataDisplay);
  }

  const updateLastLastRoundInfo = (playerList) => {
    const dataDisplay = document.getElementById("lastLastRoundInfo");
    updateRoundInfo(playerList, dataDisplay);
  }

  useEffect(() => {
    if(!contract && !address) {
      connectWalletHandler();
      // if contract + address still not initialized then show join game button
      if(web3 === null) {
        setConnectorState(buttonStates.ENABLED);
      }
    }
  }, []);

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
      const primaryAccount = accounts[0]
      setAddress(primaryAccount)

      // Create local contract copy
      setContract(gameContract(web3))

      setLog("You have joined the game.")
      setConnectorState(buttonStates.DISABLED);
      
    } catch(err) {
      console.log(err)
      // alert("Something broke. Check console logs.")
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
          if(error) {
            // alert("Something broke while trying to request tokens. Check console for details.")
            console.log(error);
            router.reload(window.location.pathname);
            return;
          }
          const interval = setInterval(function() {
            web3.eth.getTransactionReceipt(hash, function(err, rec) {
              if(err) {
                // alert("Something broke while trying to request tokens. Check console for details.")
                console.log(err);
                clearInterval(interval);
                router.reload(window.location.pathname);
              }
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
          if(error) {
            alert("Something broke while trying to check the current round number. Check console for details.")
            console.log(error);
          }
          currentRoundNumber = parseInt(_roundNumber);
          setRoundNumber(currentRoundNumber);
      })
    } catch(err) {
      alert("Something broke while trying to check what round number you are currently playing before waiting for the next one! Check console for details.");
      console.log(err);
    }
    while(doKeepWaiting) {
      try {
        await sleep(1000);
        await contract.methods.getMyPlayer().call({
            from: address
          }, async function(error, player) {
            if(error) {
              alert("Something broke while trying to retrieve your player information. Check console for details.")
              console.log(error);
            }
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
    if(parseInt(tokensToGive) < 0) {
      setLog("You can't put in a negative amount of tokens.");
      return;
    }
    setLog("Submitting...");
    setSubmitterState(buttonStates.LOADING);

    // Post to chain
    try {
      await contract.methods.addTokensToPot(tokensToGive).send({
          from: address,
        }, async function(error, hash) {
          if(error) {
            // alert("Something broke while trying to add tokens to pot.")
            console.log(error)
            router.reload(window.location.pathname);
            return;
          }
          const interval = setInterval(function() {
          web3.eth.getTransactionReceipt(hash, async function(err, rec) {
            if(err) {
              // alert("Something broke while adding tokens to pot. Check console for details.");
              console.log(err);
              clearInterval(interval);
              router.reload(window.location.pathname);
            }
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
      console.log(err);
    }
  }

  return (
    <div className={styles.main}>
      <Head>
        <title>Public Good Game on the Blockchain</title>
        <meta name="description" content="Playing a public good game on the blockchain."/>
      </Head>
      <Navbar/>
      <section id="game" className="columns">
        <div className="has-text-centered column is-one-third is-size-5">
          <div className="is-size-3">
            How to Play
          </div>
          <br/>
          <div>
            Contribute tokens to the pot every round.
            <br/><br/>
            Once every player contributes, if the total contribution is at least {minPotTotal} tokens, that total is multiplied by a factor of {profitFactor} and divided evenly amongst the players.
            <br/><br/>
            Try to earn as much money as possible!
          </div>
        </div>
        <div className="has-text-centered column is-one-third is-size-4">
          <div id="roundNumber" className="is-size-3" style={{display: (web3 === null) ? 'none' : ''}}>
            Round {roundNumber}
          </div>
          <br/>
          <div id="playerInfo" className="container" style={{display: (web3 === null) ? 'none' : ''}}>
            <p id="tokenTotal">You have {tokens} tokens.</p>
            <p id="inPotTokenTotal">You currently have {potTokens} tokens in the pot.</p>
          </div>
          <br/>
          <div id="input" style={{display: (submitterState == buttonStates.DISABLED) ? 'none' : ''}}>
            <span>How many tokens do you want to put into the pot?</span>
            <input id="tokensToGive" onChange={updateTokensToGive} className="input is-info mt-4 mb-4" type="number" placeholder="0" />
            <button id="submitButton" onClick={submitHandler} className={(submitterState != buttonStates.ENABLED) ? "button is-primary mb-2 is-loading" : "button is-primary mb-2"} disabled={(submitterState != buttonStates.ENABLED) ? true : false}>Submit</button>
          </div>
          <div className="mt-6 mb-6">
            <button id="connectWalletButton" onClick={connectWalletHandler} className="button is-primary mb-2" style={{display: (connectorState == buttonStates.DISABLED) ? 'none' : ''}} disabled={connectorState != buttonStates.ENABLED ? true : false}>Join Game</button>
            <br/>
            <button id="initializeButton" onClick={initializePlayerHandler} className={(initializerState == buttonStates.LOADING) ? "button is-primary mb-2 is-loading" : "button is-primary mb-2"} disabled={(initializerState != buttonStates.ENABLED) ? true : false} style={{display: (initializerState == buttonStates.DISABLED) ? 'none' : ''}}>Request Tokens</button>
          </div>
          <div className="container has-text-success is-size-4" style={{display: (web3 === null) ? 'none' : ''}}>
            <p>{log}</p>
          </div>
        </div>
        <div className="has-text-centered column is-one-third">
          <div className="is-size-3" style={{display: (roundInfo.length <= 0) ? 'none' : ''}}>
            Previous Round Reports
          </div>
          <br/>
          <div id="lastRoundReport" style={{display: (roundInfo.length <= 0) ? 'none' : ''}}>
            <p className="is-size-4">Last Round:</p>
            <div className="table-container">
              <table id="lastRoundTable" className="table is-bordered is-narrow is-hoverable is-size-5" style={{margin: "auto"}}/>
            </div>
            <p id="lastRoundInfo"/>
          </div>
          <br/>
          <div id="lastLastRound" style={{display: (lastRoundInfo.length <= 1) ? 'none' : ''}}>
            <p className="is-size-4">Last Last Round:</p>
            <div className="table-container">
              <table id="lastLastRoundTable" className="table is-bordered is-narrow is-hoverable is-size-5" style={{margin: "auto"}}/>
            </div>
            <p id="lastLastRoundInfo"/>
          </div>
        </div>
      </section>
    </div>
  )
  
}

export default Game