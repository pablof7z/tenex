function TestApp() {
    return (
        <div style={{ padding: "20px", fontFamily: "Arial" }}>
            <h1>TENEX Test App</h1>
            <p>If you can see this, React is working!</p>
            <button type="button" onClick={() => alert("Button clicked!")}>
                Click Me
            </button>
        </div>
    );
}

export default TestApp;
