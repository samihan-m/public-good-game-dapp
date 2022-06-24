import Head from 'next/head'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import 'bulma/css/bulma.css'
import styles from '../styles/Game.module.css'
import Navbar from '../components/navbar.js'

const HomePage = () => {
  return (
    <div className = {styles.main}>
      <Head>
        <title>BTU Public Good Game on the Blockchain</title>
        <meta name="description" content="The home page for a public good game on the blockchain"/>
      </Head>
      <Navbar/>
      <div id="buttons" className="has-text-centered">
        <a className="button is-primary is-size-3 my-4" href="/terms">Play the game!</a>
        <br/>
        <a className="button is-primary is-size-3 my-4" href="/admin">Administrate the game!</a>
      </div>
    </div>
  );
};

export default HomePage;