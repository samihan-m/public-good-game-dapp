import Head from 'next/head'
import { useState, useEffect } from 'react'
import Web3 from 'web3'
import gameContract from '../blockchain/game'
import 'bulma/css/bulma.css'
import styles from '../styles/Game.module.css'
import { Chart as ChartJS } from 'chart.js/auto'
import { Chart } from 'react-chartjs-2'
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

  /*
  Todo: add loading icons for the two reset buttons + play round
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

  const [log, setLog] = useState("Game-relevant information will appear here.\nClick Connect Wallet to begin.");
  const [connectedPlayerCount, setCPC] = useState(-1);
  const [unsubmittedPlayerCount, setUPC] = useState(-1);
  const [roundNumber, setRoundNumber] = useState(-1);
  const [isRoundPlaying, setIsRoundPlaying] = useState(false);

  const [web3, setWeb3] = useState(null);
  const [address, setAddress] = useState(null);
  const [contract, setContract] = useState(null);

  const [gameData, setGameData] = useState([]);

  // Used for disabling contract ping loops
  const [isGameRunning, setIsGameRunning] = useState(true);
  // Used for sleeping during ping loops
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // FORMATTED CHART DATA
  const [chartLabels, setChartLabels] = useState([]);
  const [chartDatasets, setChartDatasets] = useState([]);

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
      setLog("Wallet connected successfully.\nHave at least 2 players join and submit tokens in order to play a round.")
    } catch(err) {
      console.log(err.message)
      alert(err.message + "\nTry installing Metamask")
    } 
  }

  // Fetch player count / unsubmitted player count regularly and keep display updated
  const playerInfoCheckLoop = async() => {
    try {
      let connectedPlayers = -1;
      let unsubmittedPlayers = -1;
      while(isGameRunning) {
          await sleep(1000);
          await contract.methods.getPlayerCount().call({from: address}, async function(error, result) {
            // console.log("getPlayerCount:")
            // console.log(error);
            // console.log(result);
            connectedPlayers = result;
            setCPC(connectedPlayers);
          })
          await contract.methods.getUnsubmittedPlayerCount().call({from: address}, async function(error, result) {
            // console.log("getUnsubmittedPlayerCount:")
            // console.log(error);
            // console.log(result);
            unsubmittedPlayers = result;
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
        setRoundNumber(parseInt(roundNumber));
      }
    )
  }

  useEffect(() => {
    if(contract && address) {
      // Do any start-up tasks
      playerInfoCheckLoop();
      updateCurrentRoundNumber();
      createGraph();
    }
  }, [contract, address])

  const playRoundHandler = async() => {
    if(unsubmittedPlayerCount > 0) {
      setLog("You must wait until all players have submitted their tokens!");
      return;
    }
    try {
      setIsRoundPlaying(true);
      await contract.methods.playRound().send({
          from: address,
        }, async function(error, hash) {
          //console.log(error);
          //console.log(result);
          setLog("Calculating new token values...");
          const interval = setInterval(function() {
            web3.eth.getTransactionReceipt(hash, function(err, rec) {
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
    setIsRoundPlaying(false);
  }

  const collectGameData = async() => {
    let allRoundsData = [];
    let currentRoundNumber = -1;
    let playerTimelines;
    try {
      await contract.methods.getCurrentRoundNumber().call({
        from: address,
      }, async function(error, _currentRoundNumber) {
        if(error) console.log(error);
        currentRoundNumber = _currentRoundNumber;
      });
      let maxRoundNumber;
      if(currentRoundNumber <= 1) {
        alert("The graph has no data to display.");
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
      playerTimelines = {};
      // playerTimelines: A dict where each key is a player id (wallet address) and each value is a finances object of {round, walletTokens, potTokens}.
      let roundIndex = 0;
      for(let roundData of allRoundsData) {
        // console.log(`Round ${roundIndex} data: ${roundData}`);
        for(let player of roundData) {
          // console.log(`Player: ${player}`);
          let id = player[0];
          let walletTokens = player[1];
          let potTokens = player[2];
          let finances = {"roundIndex": roundIndex, "walletTokens": walletTokens, "potTokens": potTokens};
          if(id in playerTimelines) {
            playerTimelines[id].push(finances);
          } else {
            playerTimelines[id] = [finances];
          }
        }
        roundIndex++;
      }
      // console.log("Player timelines: ");
      for(var key in playerTimelines) {
        // console.log(key + ": ");
        // console.log(playerTimelines[key]);
      }
    } catch(err) {
      alert("Something went wrong collecting game data. Check console for information.");
      console.log(err);
    }
    // await downloadFile(allRoundsData);
    // await downloadFile(playerTimelines);
    return playerTimelines;
  }

  const downloadFile = (data) => {
    let savedData = JSON.stringify(data);
    let bl = new Blob([savedData], {
      type: "text/html"
    });
    let a = document.createElement("a");
    a.href = URL.createObjectURL(bl);
    a.download = "savedData.json";
    a.hidden = true;
    document.body.appendChild(a);
    a.innerHTML =
      "you shouldn't be able to read this :P";
    a.click();
  }

  const saveFile = async() => {
    downloadFile({"rounds": chartLabels, "playerData": chartDatasets});
  }

  // Graph stuff

  function randomColors(total) {
    var i = 360 / (total - 1); // distribute the colors evenly on the hue range
    var r = []; // hold the generated colors
    for (var x=0; x<total; x++)
    {
        r.push(rgbToHex(...hsvToRgb(i * x, 100, 100))); // you can also alternate the saturation and value for even more contrast between the colors
    }
    return r;
  }

  const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  var hsvToRgb = function(h, s, v) {
    var r, g, b;
    var i;
    var f, p, q, t;
  
    // Make sure our arguments stay in-range
    h = Math.max(0, Math.min(360, h));
    s = Math.max(0, Math.min(100, s));
    v = Math.max(0, Math.min(100, v));
  
    // We accept saturation and value arguments from 0 to 100 because that's
    // how Photoshop represents those values. Internally, however, the
    // saturation and value are calculated from a range of 0 to 1. We make
    // That conversion here.
    s /= 100;
    v /= 100;
  
    if (s == 0) {
      // Achromatic (grey)
      r = g = b = v;
      return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }
  
    h /= 60; // sector 0 to 5
    i = Math.floor(h);
    f = h - i; // factorial part of h
    p = v * (1 - s);
    q = v * (1 - s * f);
    t = v * (1 - s * (1 - f));
  
    switch (i) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
  
      case 1:
        r = q;
        g = v;
        b = p;
        break;
  
      case 2:
        r = p;
        g = v;
        b = t;
        break;
  
      case 3:
        r = p;
        g = q;
        b = v;
        break;
  
      case 4:
        r = t;
        g = p;
        b = v;
        break;
  
      default: // case 5:
        r = v;
        g = p;
        b = q;
    }
  
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

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
    const DATASETS_PER_PLAYER = 3;
    let colors = randomColors(Object.keys(playerTimelines).length * DATASETS_PER_PLAYER);
    
    let datasets = [];
    let playerCounter = 0;
    for(var key in playerTimelines) {
      let totalTokensDataset = {};
      let walletTokensDataset = {};
      let potTokensDataset = {};
      /*
      datasets: [
        {
          label: "",
          data: chartData,
        },
      ],
      */
      totalTokensDataset["label"] = `P${playerCounter + 1} Total Tokens`;
      walletTokensDataset["label"] = `P${playerCounter + 1} Wallet`;
      potTokensDataset["label"] = `P${playerCounter + 1} Pot`;
      let playerTimeline = playerTimelines[key];
      let newTotalTokensData = [];
      let newWalletData = [];
      let newPotData = [];
      for(let finances of playerTimeline) {         newTotalTokensData.push(parseInt(finances["walletTokens"]) + parseInt(finances["potTokens"]));
        newWalletData.push(finances["walletTokens"]);
        newPotData.push(finances["potTokens"]);
      }
      totalTokensDataset["data"] = newTotalTokensData;
      walletTokensDataset["data"] = newWalletData;
      potTokensDataset["data"] = newPotData;
      totalTokensDataset["borderColor"] = colors[DATASETS_PER_PLAYER*playerCounter]
      walletTokensDataset["borderColor"] = colors[DATASETS_PER_PLAYER*playerCounter + 1];
      potTokensDataset["borderColor"] = colors[DATASETS_PER_PLAYER*playerCounter + 2];
      totalTokensDataset["backgroundColor"] = colors[DATASETS_PER_PLAYER*playerCounter];
      walletTokensDataset["backgroundColor"] = colors[DATASETS_PER_PLAYER*playerCounter + 1];
      potTokensDataset["backgroundColor"] = colors[DATASETS_PER_PLAYER*playerCounter + 2];
      datasets.push(totalTokensDataset);
      datasets.push(walletTokensDataset);
      datasets.push(potTokensDataset);
      console.log(`Added datasets for player ${playerCounter}: ${walletTokensDataset} ${potTokensDataset}`);
      playerCounter++;
    }
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
      await contract.methods.resetAllPlayerFinances().send({
        from: address,
      }, async function(error, hash) {
        setLog("Resetting player finances...");
        const interval = setInterval(function() {
          web3.eth.getTransactionReceipt(hash, function(err, rec) {
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
  }

  const resetGame = async() => {
    let givenPassword = window.prompt("This will completely reset everything, including player token counts and deleting all previous round information from the game. Enter password to confirm:");
    if(isPasswordCorrect(givenPassword) == false) {
      alert("Incorrect password.");
      return;
    }
    try {
      await contract.methods.completelyResetGame().send({
        from: address,
      }, async function(error, hash) {
        setLog("Resetting the entire game...");
        const interval = setInterval(function() {
          web3.eth.getTransactionReceipt(hash, function(err, rec) {
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
  }
  
  return (
    <div className = {styles.main}>
      <Head>
        <title>Public Good Game on the Blockchain Admin Page</title>
        <meta name="description" content="The admin panel ge for a public good game on the blockchain"/>
      </Head>
      <nav className="navbar mt-4 mb-4">
        <div className="container">
          <div className="navbar-brand">
            <h1>Public Good Game Admin Panel</h1>
          </div>
          <div className="navbar-end">
          </div>
        </div>
      </nav>
      <section id="connectButtonSection" className="has-text-centered" style={{display: (web3 === null ? "" : "none")}}>
        <div id="connectButtonContainer">
          <button id="connectWalletButton" onClick={connectWalletHandler} disabled={web3 === null ? false : true} className="button is-primary mb-2">{web3 === null ? "Connect Wallet" : "Connected"}</button>
        </div>
      </section>
      <section id="game" className="has-text-centered" style={{display: (web3 === null ? "none" : "")}}>
        <div id="info" className="">
          <h2 id="log">{log}</h2>
          <br></br>
          <h2 id="roundNumber">Round {roundNumber}</h2>
          <p id="connectedPlayersCount">Players connected: {connectedPlayerCount}</p>
          <p id="unsubmittedPlayersCount">Players yet to submit: {unsubmittedPlayerCount}</p>
        </div>
        <div id="playButtons" className="">
          <button id="playRound" className="button mx-2" 
            disabled={((unsubmittedPlayerCount == 0) && (connectedPlayerCount > 0) && (isRoundPlaying == false)) ? false : true} onClick={playRoundHandler}>Play Round</button>
          <button id="saveData" className="button mx-2" disabled={(roundNumber > 1) ? false : true} onClick={saveFile}>Save Data</button>
        </div>
        <div id="data" className="" style={{padding: "0% 15% 0% 15%", height: "75%"}}>
          { chartDatasets ? (
            <Line
              data={data}
            />
            ) : null}
        </div>
        <div id="resetButtons" className="">
          <button id="resetPlayerFinances" className="button is-danger mx-2" onClick={resetPlayerFinances}>Reset Player Finances</button>
          <button id="resetGame" className="button is-danger mx-2" onClick={resetGame}>Reset Game</button>
        </div>
      </section>
    </div>
  )
}

export default AdminPage