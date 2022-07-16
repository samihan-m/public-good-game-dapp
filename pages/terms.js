import Head from 'next/head'
import 'bulma/css/bulma.css'
import styles from '../styles/Game.module.css'
import Navbar from '../components/navbar.js'

const TermsPage = () => {
  return (
    <div className = {styles.main}>
      <Head>
        <title>BTU Public Good Game on the Blockchain</title>
        <meta name="description" content="Terms you must accept before playing a public good game on the blockchain"/>
      </Head>
      <Navbar/>
      <div id="information" className="has-text-centered is-size-4">
        <p>Read these terms before continuing on to the game:</p>
        <br/>
        <ul>
          <li>Term 1 (TBD)</li>
          <li>Term 2 (TBD)</li>
          <li>Term 3 (TBD)</li>
        </ul>
        <br/>
        <a href="/play" className="button is-primary">I accept</a>
      </div>
    </div>
  );
};

export default TermsPage;