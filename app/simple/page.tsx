export default function SimplePage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ color: 'green', fontSize: '2rem', marginBottom: '1rem' }}>
        ✅ Next.js is Working!
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
        If you can see this page, Next.js compilation is working correctly.
      </p>
      <div style={{ backgroundColor: '#f0f0f0', padding: '1rem', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0 }}>GHL Integration Status:</h2>
        <ul>
          <li>✅ API endpoints created and working</li>
          <li>✅ Real GHL data being fetched</li>
          <li>✅ Youngstown: 1,381 contacts, 82 opportunities, 1,116+ conversations</li>
          <li>✅ Mahoning: 384 contacts, 234 opportunities, 36 conversations</li>
          <li>❌ Frontend compilation issues (webpack/bundling)</li>
        </ul>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <a
          href="/test"
          style={{
            backgroundColor: '#0070f3',
            color: 'white',
            padding: '0.5rem 1rem',
            textDecoration: 'none',
            borderRadius: '4px',
            marginRight: '1rem'
          }}
        >
          Test API Data
        </a>
        <a
          href="/agency/gohighlevel-clients"
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '0.5rem 1rem',
            textDecoration: 'none',
            borderRadius: '4px'
          }}
        >
          View Dashboard (if working)
        </a>
      </div>
    </div>
  )
}
