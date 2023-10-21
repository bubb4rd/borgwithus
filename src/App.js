import './App.css';
import About from './components/About';
import Borg from './components/Borg';
import Home from './components/Home';
import NavBar from './components/Navbar';
function App() {
  return (
    <div className="App">
      <NavBar/>
      <Home/>
      <About/>
      <Borg/>
    </div>
  );
}

export default App;
