import SquashGameDemo from './SquashGame';

function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#000' }}>
      <h1 style={{ color: '#00ffcc', textAlign: 'center', paddingTop: '20px' }}>
        Squash
      </h1>
      <SquashGameDemo />
    </div>
  );
}

export default App;