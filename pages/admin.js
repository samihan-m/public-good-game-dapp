import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Web3 from 'web3'
import gameContract from '../blockchain/game'
import 'bulma/css/bulma.css'
import styles from '../styles/Game.module.css'
import Navbar from '../components/navbar.js'
// I believe this import is required despite it not appearing to be the case
import { Chart as ChartJS } from 'chart.js/auto'
import getRandomColors from '../utils/utils'
import {Line} from 'react-chartjs-2';

const AdminPage = () => {
  /*
What needs to go here?

Admin panel
1. See number of players
  - Auto update, every second?
2. See number of players yet to submit
  - Auto update, every second?
3. See round number
  - Update after play round
  - Start update check loop after play round is clicked
  - Stop update check loop after round is updated
4. Play round
  - Locked until player count > 2, unreadied player count = 0
5. See round data -> Table ? Graph ?
  - Update after play round
  - Start update check loop after play round is clicked
  - Stop update check loop after round is updated
  */

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

  const [log, setLog] = useState("Game-relevant information will appear here.\nClick Connect Wallet to begin.");
  const [connectedPlayerCount, setCPC] = useState(-1);
  const [unsubmittedPlayerCount, setUPC] = useState(-1);
  const [roundNumber, setRoundNumber] = useState(-1);

  const [web3, setWeb3] = useState(null);
  const [address, setAddress] = useState(null);
  const [contract, setContract] = useState(null);

  const [isGameRunning, setIsGameRunning] = useState(true);

  // Used for sleeping during ping loops
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // RAW PLAYER DATA
  const [playerData, setPlayerData] = useState([]);
  
  // FORMATTED CHART DATA
  const [chartLabels, setChartLabels] = useState([]);
  const [chartDatasets, setChartDatasets] = useState([]);

  const [connectorState, setConnectorState] = useState(buttonStates.DISABLED);
  const [roundStarterState, setRoundStarterState] = useState(buttonStates.DISABLED);
  const [moneyResetterState, setMoneyResetterState] = useState(buttonStates.ENABLED);
  const [gameResetterState, setGameResetterState] = useState(buttonStates.ENABLED);

  const router = useRouter();

  const data = {
    labels: chartLabels,
    datasets: chartDatasets,
    /*
    datasets: [
      {
        data: chartData,
      },
    ],
    */
  };
  
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

      // Update display
      setLog("Have at least 2 players join and submit tokens in order to play a round.")
      setConnectorState(buttonStates.DISABLED);
    } catch(err) {
      console.log(err.message);
      alert(err.message + "\nTry installing Metamask");
    } 
  }

  // Fetch player count / unsubmitted player count regularly and keep display updated
  const playerInfoCheckLoop = async() => {
    try {
      while(isGameRunning) {
          await sleep(1000);
          await contract.methods.getPlayerCount().call({from: address}, async function(error, result) {
            if(error) {
              alert("Something broke while trying to read game information from the blockchain! Check console for details.");
              console.log(error);
            }
            let connectedPlayers = result;
            setCPC(connectedPlayers);
          })
          await contract.methods.getUnsubmittedPlayerCount().call({from: address}, async function(error, result) {
            if(error) {
              alert("Something broke while trying to read game information from the blockchain! Check console for details.");
              console.log(error);
            }
            let unsubmittedPlayers = result;
            setUPC(unsubmittedPlayers);
          })
      }
    } catch(err) {
      console.log(err)
      alert("Connection to contract broken! Check console logs.")
    }
  }

  const updateCurrentRoundNumber = async() => {
    await contract.methods.getCurrentRoundNumber().call({
        from: address,
      }, async function(error, roundNumber) {
        if(error) {
          alert("Something broke while trying to read the current round number from the blockchain! Check console for details.")
          console.log(error);
        }
        setRoundNumber(parseInt(roundNumber));
      }
    )
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
      // Do any start-up tasks
      playerInfoCheckLoop();
      updateCurrentRoundNumber();
      createGraph();
    }
  }, [contract, address])

  useEffect(() => {
    if(connectedPlayerCount >= 2 && unsubmittedPlayerCount == 0 && roundStarterState == buttonStates.DISABLED) {
      setRoundStarterState(buttonStates.ENABLED);
    }
  }, [unsubmittedPlayerCount, connectedPlayerCount])

  const playRoundHandler = async() => {
    if(unsubmittedPlayerCount > 0) {
      setLog("You must wait until all players have submitted their tokens!");
      return;
    }
    try {
      setRoundStarterState(buttonStates.LOADING);
      await contract.methods.playRound().send({
          from: address,
        }, async function(error, hash) {
          if(error) {
            // alert("Something broke while trying to play the round. Check console for details.");
            console.log(error);
            router.reload(window.location.pathname);
            return;
          }
          setLog("Playing round...");
          const interval = setInterval(function() {
            web3.eth.getTransactionReceipt(hash, function(err, rec) {
              if(err) {
                // alert("Something broke while waiting for the round to be played.");
                console.log(error);
                clearInterval(interval);
                router.reload(window.location.pathname);
              }
              if (rec) {
                clearInterval(interval);
                setLog("Round played!");
                updateCurrentRoundNumber();
                createGraph();
              }
            });
          }, 1000);
        }
      )
    } catch(err) {
      alert("Playing the round failed. Check console for more details.");
      console.log(err);
    }
    setRoundStarterState(buttonStates.DISABLED);
  }

  const collectGameData = async() => {
    let allRoundsData = [];
    let currentRoundNumber = -1;
    let playerTimelines;
    try {
      await contract.methods.getCurrentRoundNumber().call({
        from: address,
      }, async function(error, _currentRoundNumber) {
        if(error) {
          alert("Something went wrong trying to collect all past round data from the blockchain. Check console for details.")
          console.log(error);
        }
        currentRoundNumber = _currentRoundNumber;
      });
      let maxRoundNumber;
      if(currentRoundNumber <= 0) {
        alert("The graph has no data to display. Play a round!");
        return [];
      }
      // -1 because we don't yet have data for the current round
      maxRoundNumber = currentRoundNumber - 1;
      // console.log("Iterating from 0 to " + maxRoundNumber);
      for(let i = 0; i < maxRoundNumber; i++) {
        await contract.methods.getRoundData(i).call({
          from: address,
        }, async function(error, roundData) {
          if(error) console.log(error);
          // console.log(`Round data for round ${i}: ${roundData}`);
          allRoundsData.push(roundData);
        });
      }
      await contract.methods.getCurrentRoundData().call({
        from: address,
      }, async function(error, currentRoundData) {
        if(error) console.log(error);
        allRoundsData.push(currentRoundData);
      })
      setPlayerData(allRoundsData);
      playerTimelines = {};
      // playerTimelines: A dict where each key is a player id (wallet address) and each value is a finances object of {round, walletTokens, potTokens}.
      let roundIndex = 0;
      for(let roundData of allRoundsData) {
        for(let player of roundData) {
          let finances = {"roundIndex": roundIndex, "walletTokens": player.walletTokens, "potTokens": player.potTokens};
          if(player.id in playerTimelines) {
            playerTimelines[player.id].push(finances);
          } else {
            playerTimelines[player.id] = [finances];
          }
        }
        roundIndex++;
      }
    } catch(err) {
      alert("Something went wrong collecting game data. Check console for information.");
      console.log(err);
    }
    return playerTimelines;
  }

  const getCSVData = (roundData) => {
    let csvData = "";
    csvData = "ID, Wallet Tokens, Pot Tokens";
    for(let playerList of roundData) {
      let walletTotal = 0;
      let potTotal = 0;
      for(let player of playerList) {
        console.log(player);
        csvData += `\n${player.id}, ${player.walletTokens}, ${player.potTokens}`;
        walletTotal += parseInt(player.walletTokens);
        potTotal += parseInt(player.potTokens);
      }
      csvData += `\nTotal, ${walletTotal}, ${potTotal}`;
    }
    console.log(csvData);
    return csvData;
  }

  const downloadFile = (data) => {
    let bl = new Blob([data], {
      type: "text/html"
    });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(bl);
    a.download = "savedData.csv";
    a.hidden = true;
    document.body.appendChild(a);
    a.click();
  }

  const saveFile = async() => {
    downloadFile(getCSVData(playerData));
  }

  const createGraph = async () => {
    let playerTimelines = await collectGameData();
    if(playerTimelines.size == 0) {
      return;
    }
    let labels = [];
    let maxRounds = -1;
    for(var key in playerTimelines) {
      if(maxRounds < playerTimelines[key].length) {
        maxRounds = playerTimelines[key].length;
      }
    }
    for(let i = 0; i < maxRounds; i++) {
      labels.push(i);
    }
    setChartLabels(labels);

    // Three colors per player: total tokens, wallet tokens, pot tokens
    // One more for the overall total
    const DATASETS_PER_PLAYER = 3;
    const COLOR_COUNT = (Object.keys(playerTimelines).length * DATASETS_PER_PLAYER) + 1;
    let colors = getRandomColors(COLOR_COUNT);
    
    let datasets = [];
    let playerCounter = 0;
    for(var key in playerTimelines) {
      let totalTokensDataset = {
        label: `P${playerCounter + 1} Total Tokens`,
        data: [],
        borderColor: colors[DATASETS_PER_PLAYER*playerCounter],
        backgroundColor: colors[DATASETS_PER_PLAYER*playerCounter],
      };
      let walletTokensDataset = {
        label: `P${playerCounter + 1} Wallet`,
        data: [],
        borderColor: colors[DATASETS_PER_PLAYER*playerCounter + 1],
        backgroundColor: colors[DATASETS_PER_PLAYER*playerCounter + 1],
      };
      let potTokensDataset = {
        label: `P${playerCounter + 1} Pot`,
        data: [],
        borderColor: colors[DATASETS_PER_PLAYER*playerCounter + 2],
        backgroundColor: colors[DATASETS_PER_PLAYER*playerCounter + 2]
      };
      let playerTimeline = playerTimelines[key];
      for(let finances of playerTimeline) {
        let totalPlayerTokens = parseInt(finances.walletTokens) + parseInt(finances.potTokens);
        totalTokensDataset.data.push(totalPlayerTokens);
        walletTokensDataset.data.push(finances.walletTokens);
        potTokensDataset.data.push(finances.potTokens);
      }
      datasets.push(totalTokensDataset, walletTokensDataset, potTokensDataset);
      playerCounter++;
    }
    let allPlayerTotalTokensDataset = {
      label: "Combined Total Tokens",
      data: [],
      borderColor: colors[colors.length - 1],
      backgroundColor: colors[colors.length - 1],
    };
    let tokenTotalsPerRound = {};
    for(let playerDataset of datasets) {
      let roundIndex = 0;
      for(let roundTokenTotal of playerDataset.data) {
        // TODO: Do this more intelligently (exclude non-total token datasets from the calculations)
        if(playerDataset.label.includes("Total") == false) {
          continue;
        }
        if(tokenTotalsPerRound[roundIndex] == undefined) {
          tokenTotalsPerRound[roundIndex] = 0;
        }
        tokenTotalsPerRound[roundIndex] += parseInt(roundTokenTotal);
        roundIndex++;
      }
    }
    for(let round in tokenTotalsPerRound) {
      allPlayerTotalTokensDataset.data.push(
        tokenTotalsPerRound[round]
      );
    }
    datasets.push(allPlayerTotalTokensDataset);
    setChartDatasets(datasets);
  }

  const isPasswordCorrect = (password) => {
    return (password == "btu22");
  }

  const resetPlayerFinances = async() => {
    let givenPassword = window.prompt("This will reset all player token counts to the default starting value (probably 100). Enter password to confirm:");
    if(isPasswordCorrect(givenPassword) == false) {
      alert("Incorrect password.");
      return;
    }
    try {
      setMoneyResetterState(buttonStates.LOADING);
      await contract.methods.resetAllPlayerFinances().send({
        from: address,
      }, async function(error, hash) {
        if(error) {
          alert("Something broke while resetting player finances. Check console for details.")
          console.log(error);
          return;
        }
        setLog("Resetting player finances...");
        const interval = setInterval(function() {
          web3.eth.getTransactionReceipt(hash, function(err, rec) {
            if(err) {
              // alert("Something broke while waiting for player finances to be reset.")
              console.log(err);
              clearInterval(interval);
              router.reload(window.location.pathname);
            }
            if (rec) {
              clearInterval(interval);
              setLog("All players token counts reset!");
              updateCurrentRoundNumber();
              createGraph();
            }
          });
        }, 1000);
      })
    } catch(err) {
      alert("Resetting player finances failed. Check console for details.")
      console.log(err);
    }
    setMoneyResetterState(buttonStates.ENABLED);
  }

  const resetGame = async() => {
    let givenPassword = window.prompt("This will completely reset everything, including player token counts and deleting all previous round information from the game. Enter password to confirm:");
    if(isPasswordCorrect(givenPassword) == false) {
      alert("Incorrect password.");
      return;
    }
    try {
      setGameResetterState(buttonStates.LOADING);
      await contract.methods.completelyResetGame().send({
        from: address,
      }, async function(error, hash) {
        if(error) {
          // alert("Something broke while completely resetting the game. Check console for details.");
          console.log(error);
          router.reload(window.location.pathname);
          return;
        }
        setLog("Resetting the entire game...");
        const interval = setInterval(function() {
          web3.eth.getTransactionReceipt(hash, function(err, rec) {
            if(err) {
              // alert("Something broke while waiting for the game to be completely reset.");
              console.log(err);
              clearInterval(interval);
              router.reload(window.location.pathname);
            }
            if (rec) {
              clearInterval(interval);
              setLog("The game has been reset!");
              updateCurrentRoundNumber();
              createGraph();
            }
          });
        }, 1000);
      })
    } catch(err) {
      alert("Resetting the game failed. Check console for details.")
      console.log(err);
    }
    setGameResetterState(buttonStates.ENABLED);
  }
  
  return (
    <div className = {styles.main}>
      <Head>
        <title>Public Good Game on the Blockchain Admin Page</title>
        <meta name="description" content="The admin panel for a public good game on the blockchain."/>
      </Head>
      <Navbar/>
      <section id="connectButtonSection" className="has-text-centered" style={{display: (connectorState != buttonStates.ENABLED ? "none" : "")}}>
        <div id="connectButtonContainer">
          <button id="connectWalletButton" onClick={connectWalletHandler} disabled={connectorState != buttonStates.ENABLED ? true : false} className="button is-primary mb-2">{web3 === null ? "Connect Wallet" : "Connected"}</button>
        </div>
      </section>
      <section id="game" className="has-text-centered" style={{display: (web3 === null ? "none" : "")}}>
        <div id="info" className="is-size-5">
          <p id="roundNumber" className="is-size-3">Round {roundNumber}</p>
          <p id="connectedPlayersCount">Players connected: {connectedPlayerCount}</p>
          <p id="unsubmittedPlayersCount">Players yet to submit: {unsubmittedPlayerCount}</p>
        </div>
        <div id="playButtons">
          <button id="playRound"
            className={(roundStarterState == buttonStates.LOADING) ? "button is-primary mx-2 my-2 is-loading" : "button is-primary mx-2 my-2"} 
            disabled={(roundStarterState != buttonStates.ENABLED) ? true : false} onClick={playRoundHandler}
          >
            Play Round
          </button>
          <button id="saveData" 
          className="button mx-2 my-2 is-primary" 
          disabled={(roundNumber > 1) ? false : true} 
          onClick={saveFile}
          >
            Save Data
          </button>
        </div>
        <br/>
        <p id="log" className="has-text-primary is-size-4">{log}</p>
        <br/>
        <div id="data" className="" style={{padding: "0% 25% 0% 25%", height: "75%"}}>
          { chartDatasets ? (<Line data={data}/>) : null}
        </div>
        <br/>
        <div id="resetButtons">
          <button id="resetPlayerFinances" 
            className={(moneyResetterState == buttonStates.LOADING) ? "button is-danger mx-2 is-loading" : "button is-danger mx-2"} 
            disabled={(moneyResetterState != buttonStates.ENABLED) ? true : false} onClick={resetPlayerFinances}
          >
            Reset Player Finances
          </button>
          <button id="resetGame" 
            className={(gameResetterState == buttonStates.LOADING) ? "button is-danger mx-2 is-loading" : "button is-danger mx-2"} 
            disabled={(gameResetterState != buttonStates.ENABLED) ? true : false} onClick={resetGame}
          >
            Reset Game
          </button>
        </div>
      </section>
    </div>
  )
}

export default AdminPage;