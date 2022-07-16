const Navbar = () => {
  return (
    <nav className="navbar mt-4 mb-4">
      <div className="container">
        <div className="navbar-brand">
          <a className="navbar-item" href="/">
            <img src="https://www.b-tu.de/typo3conf/ext/btu_template/Resources/Public/Images/logo/BTULogo_deutsch_grau_2x.png" alt="BTU"/>
          </a>
        </div>
        <div id="navbar-menu" className="navbar-menu">
          <div className="navbar-start">
            <a href="/terms" className="navbar-item button mx-2">
              <h2>Play</h2>
            </a>
            <a href="/admin" className="navbar-item button mx-2">
              <h2>Administration</h2>
            </a>
          </div>
        </div>
        <div className="navbar-end">
          <h1>Public Good Game on the Blockchain</h1>
        </div>
      </div>
    </nav>
  );
}

export default Navbar