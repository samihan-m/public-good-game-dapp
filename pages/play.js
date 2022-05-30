import Head from 'next/head'
import { useState, useEffect } from 'react'
import Web3 from 'web3'
import gameContract from '../blockchain/game'
import 'bulma/css/bulma.css'
import styles from '../styles/Game.module.css'

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

  const [error, setError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [tokenTotal, setTokenTotal] = useState(0)
  const [inPotTokenTotal, setInPotTokenTotal] = useState(0)
  const [tokensToPut, setTokensToPut] = useState(0)
  const [web3, setWeb3] = useState(null)
  const [address, setAddress] = useState(null)
  const [contract, setContract] = useState(null)

  const [isConnectButtonDisabled, setIsConnectButtonDisabled] = useState(false)
  const [isInitializeButtonDisabled, setIsInitalizeButtonDisabled] = useState(true)
  const [isInputFormDisabled, setIsInputFormDisabled] = useState(true)
  const [isSubmitButtonDisabled, setIsSubmitButtonDisabled] = useState(true)

  useEffect(() => {
    if(contract && address) getInfoHandler()
  }, [contract, address])

  const setConnectButtonEnabled = async (status) => {
    const initializeButton = document.getElementById("connectWalletButton")
    if(status == true) {
      initializeButton.innerText = "Connect Wallet"
      setIsConnectButtonDisabled(false)
    }
    else {
      initializeButton.innerText = "Connected"
      setIsConnectButtonDisabled(true)
    }
  }

  const setInitializeButtonEnabled = async (status) => {
    const initializeButton = document.getElementById("initializeButton")
    if(status == true) {
      initializeButton.innerText = "Initialize Player"
      setIsInitalizeButtonDisabled(false)
    }
    else {
      initializeButton.innerText = "Initialized"
      setIsInitalizeButtonDisabled(true)
    }
  }

  const setInputFormEnabled = async (status) => {
    if(status == true) {
      setIsInputFormDisabled(false)
      setIsSubmitButtonDisabled(false)
    }
    else {
      setIsInputFormDisabled(true)
      setIsSubmitButtonDisabled(true)
    }
  }

  const setSubmitButtonEnabled = async (status) => {
    const submitButton = document.getElementById("submitButton")
    if(status == true) {
      submitButton.innerText = "Submit"
      setIsSubmitButtonDisabled(false)
    }
    else {
      submitButton.innerText = "Submitted"
      setIsSubmitButtonDisabled(true)
    }
  }

  const getInfoHandler = async () => {
    // Get information from blockchain
    await contract.methods.getMyInfo().call({from: address}, function(error, result){
      console.log(error)
      console.log(result)

      let isInitialized = result[0]
      let tokenTotal = result[1]
      let inPotTokenTotal = result[2]

      // If user is uninitialized, inform them + allow them to click Initialize Player
      if(isInitialized == false){
        // alert("You must initialize your player account!")
        console.log("You must initialize your player account!")
        setError("You have to Initialize Player before you can play.")
        setInitializeButtonEnabled(true)
      }
      // If the user is initialized, load their data and give them access to the game
      else {
        setInitializeButtonEnabled(false)
        setSuccessMsg("Player information loaded successfully. You may now play!")
        setError("")
        setInputFormEnabled(true)
        setTokenTotal(tokenTotal)
        setInPotTokenTotal(inPotTokenTotal)

        if(parseInt(inPotTokenTotal) > 0) {
          setIsSubmitButtonDisabled(true)
          setSuccessMsg("You already submitted your turn this round. Wait for the next round!")
        }
      }
    })
  }

  const connectWalletHandler = async() => {
    // Check if Metamask is installed
    if(typeof window == "undefined" || typeof window.ethereum == "undefined") {
      setError("Please install Metamask!")
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

      setSuccessMsg("Wallet connected successfully.")
      setError("")

      // Disable Connect button
      setConnectButtonEnabled(false)
    } catch(err) {
      console.log(err.message)
      setError(err.message)
    } 
    
  }

  const initializePlayerHandler = async() => {
    // Disable initialize button so users do not do it multiple times
    setInitializeButtonEnabled(false)
    
    try {
      // Call initializePlayer contract function
      await contract.methods.initializePlayer().send({
        from: address,
      }, async function(error, result){
        // Now reload player info
        var isInitialized = false
        while(isInitialized == false) {
          await contract.methods.getMyInfo().call({from: address}, function(error, result){
            isInitialized = result[0]
            let tokenTotal = result[1]
            let inPotTokenTotal = result[2]

            if(isInitialized == false) {
              return
            }
  
            // Update display
            setTokenTotal(tokenTotal)
            setInPotTokenTotal(inPotTokenTotal)
      
            setSuccessMsg("Player information loaded successfully. You may now play!")
            setError("")

            // Enable game form
            setInputFormEnabled(true)
          })
        }
      })
    } catch(err) {
      setError(err.message)
    }
    
  }

  // Update state variable with user input on change
  const updateTokensToPut = event => {
    setTokensToPut(event.target.value)
  }

  const submitTokens = async() => {
    // Validate input
    if(tokensToPut != parseInt(tokensToPut)) {
      setError("The value must be a number.")
      return
    }
    if(parseInt(tokensToPut) > parseInt(tokenTotal)) {
      setError("You can't put more tokens than you own.")
      return
    }
    setError("")

    // Disable button so users can only submit once per round
    setSubmitButtonEnabled(false)

    try {
      // Get current round number from chain so we know when the round has passed
      let currentRound
      await contract.methods.getRoundNumber().call({from: address}, async function(error, result) {
        console.log(error)
        console.log("Current round number: " + result)
        currentRound = result
        // Call addTokens function
        await contract.methods.addTokens(tokensToPut).send({from: address}, async function(error, result) {

          // Update display
          setTokenTotal(parseInt(tokenTotal) - parseInt(tokensToPut))
          setInPotTokenTotal(parseInt(inPotTokenTotal) + parseInt(tokensToPut))
          setTokensToPut(0)
          document.getElementById("tokensToGive").value = 0

          console.log("Before disabling submit button")

          // Wait until round passes, then update display with new information
          let newRound = currentRound
          while(newRound == currentRound) {
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            console.log("Waiting for new round...")
            await sleep(2000)
            await contract.methods.getRoundNumber().call({from: address}, async function(error, result) {
              console.log(error)
              console.log(result)
              newRound = result
            })
          }
          // Get new information for display
          await contract.methods.getMyInfo().call({from: address}, function(error, result) {
            console.log(error)
            console.log(result)
            // Update display
            setTokenTotal(result[1])
            setInPotTokenTotal(0)
            setInputFormEnabled(true)
            setSubmitButtonEnabled(true)
            setSuccessMsg("A new round has started! Find your new token total above.")
          })
        })
      })
    } catch(err) {
      setError(err)
    }
  }

  const playRoundHandler = async() => {
    // Ask for password
    const givenPassword = prompt("Enter play round password:")
    if(givenPassword == "go!") {
      // Call play round
      await contract.methods.playRound().send({from: address}, async function(error, result) {
        console.log(error)
        console.log(result)

        await contract.methods.getMyInfo().call({from: address}, function(error, result){
          console.log(error)
          console.log(result)
        })

        setSuccessMsg("Played the round! Everybody's totals should have been updated.")
      })
    }
    else {
      alert("Incorrect password.")
    }
  }

  /*
  What components does this page need?

  What does the UI need?
  1. A way to see current game state (Your info - total tokens + amount in pot + maybe amount of players playing?)
  2. A way to add tokens to pot
  3. A way to play the round (maybe once everybody clicks a button 'confirm' it auto plays the round?)

  So the components are:
  1. Display the amount of connected players at the top??
  2. Player info display (total tokens, amount in pot)
  3. Add tokens component (amount, confirm)
  */

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
        <div className="column is-one-third"></div>
        <div className="has-text-centered column is-one-third is-size-4">
          <div id="playerInfo" className="container">
            <p id="tokenTotal">You have {tokenTotal} tokens.</p>
            <p id="inPotTokenTotal">You currently have {inPotTokenTotal} tokens in the pot.</p>
          </div>
          <br></br>
          <div id="input" style={{display: (isInputFormDisabled) ? 'none' : ''}}>
            <span>How many tokens do you want to put into the pot?</span>
            <input id="tokensToGive" onChange={updateTokensToPut} className="input is-info mt-4 mb-4" type="number" placeholder="0" />
            <button id="submitButton" onClick={submitTokens} className="button is-primary mb-2" disabled={isSubmitButtonDisabled}>Submit</button>
          </div>
          <div className="mt-6 mb-6">
            <button id="connectWalletButton" onClick={connectWalletHandler} className="button is-primary mb-2" disabled={isConnectButtonDisabled}>Join Game</button>
            <br />
            <button id="initializeButton" onClick={initializePlayerHandler} className="button is-primary mt-2" disabled={isInitializeButtonDisabled}>Initialize Player</button>
          </div>
          <div className="container has-text-danger is-size-5">
            <p>{error}</p>
          </div>
          <div className="container has-text-success is-size-5">
            <p>{successMsg}</p>
          </div>
          <div>
            <button id="playRoundButton" onClick={playRoundHandler} className="button is-danger mt-2">ADMIN ONLY:<br/>Play Round</button>
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